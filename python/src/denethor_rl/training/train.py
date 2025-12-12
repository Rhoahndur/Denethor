"""
Main training script using PufferLib PPO.

This script provides a clean training loop for browser game environments.
It uses PufferLib's vectorization and a custom PPO implementation.
"""

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

import pufferlib
import pufferlib.vector

from .puffer_env import make_env
from ..policies.cnn_policy import GameCNNPolicy
from ..games.registry import list_game_categories


@dataclass
class TrainingConfig:
    """Training hyperparameters."""

    # Environment
    game_url: str = ""
    game_category: str = "arcade"
    use_universal_actions: bool = False

    # Vectorization
    num_envs: int = 4  # Number of parallel environments
    num_workers: int = 2  # Number of worker processes

    # Training
    total_timesteps: int = 100_000
    learning_rate: float = 3e-4
    num_steps: int = 128  # Steps per rollout
    num_minibatches: int = 4
    update_epochs: int = 4
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_coef: float = 0.2
    ent_coef: float = 0.01
    vf_coef: float = 0.5
    max_grad_norm: float = 0.5

    # Logging
    log_interval: int = 1000
    save_interval: int = 10000
    output_dir: str = "outputs"
    experiment_name: str = "browser_game"
    use_wandb: bool = False

    # Device
    device: str = "cpu"


class PPOTrainer:
    """PPO trainer for PufferLib environments."""

    def __init__(
        self,
        config: TrainingConfig,
        vecenv,
        policy: nn.Module,
        action_map: dict = None,
    ):
        self.config = config
        self.vecenv = vecenv
        self.policy = policy.to(config.device)
        self.device = config.device
        self.action_map = action_map or {}

        self.optimizer = optim.Adam(policy.parameters(), lr=config.learning_rate)

        # Storage for rollouts
        self.obs = torch.zeros(
            (config.num_steps, config.num_envs) + vecenv.single_observation_space.shape,
            dtype=torch.uint8,
        )
        self.actions = torch.zeros((config.num_steps, config.num_envs), dtype=torch.long)
        self.rewards = torch.zeros((config.num_steps, config.num_envs))
        self.dones = torch.zeros((config.num_steps, config.num_envs))
        self.values = torch.zeros((config.num_steps, config.num_envs))
        self.log_probs = torch.zeros((config.num_steps, config.num_envs))

        # Tracking
        self.global_step = 0
        self.episode_rewards = []
        self.episode_lengths = []
        self.step_rewards = []  # Track per-step rewards for browser envs
        self.recent_actions = []  # Track recent actions for logging

    def collect_rollout(self, obs: np.ndarray) -> np.ndarray:
        """Collect a rollout of experience."""
        for step in range(self.config.num_steps):
            self.global_step += self.config.num_envs

            # Store current observation
            self.obs[step] = torch.from_numpy(obs)

            # Get action from policy
            with torch.no_grad():
                obs_tensor = torch.from_numpy(obs).to(self.device)
                action_logits, value = self.policy(obs_tensor)
                dist = torch.distributions.Categorical(logits=action_logits)
                action = dist.sample()
                log_prob = dist.log_prob(action)

            self.actions[step] = action.cpu()
            self.values[step] = value.squeeze(-1).cpu()
            self.log_probs[step] = log_prob.cpu()

            # Track action names for logging
            for a in action.cpu().numpy():
                action_info = self.action_map.get(int(a), ("?", "?"))
                self.recent_actions.append(f"{action_info[0]}:{action_info[1]}")
            # Keep only last 50 actions
            self.recent_actions = self.recent_actions[-50:]

            # Step environment
            obs, rewards, terms, truncs, infos = self.vecenv.step(action.cpu().numpy())

            self.rewards[step] = torch.from_numpy(rewards)
            self.dones[step] = torch.from_numpy(terms | truncs)

            # Track step rewards (for browser envs where episodes rarely complete)
            self.step_rewards.extend(rewards.tolist())

            # Track episode statistics
            for i, info in enumerate(infos):
                if "episode" in info:
                    self.episode_rewards.append(info["episode"]["r"])
                    self.episode_lengths.append(info["episode"]["l"])

        return obs

    def compute_gae(self, next_obs: np.ndarray) -> tuple[torch.Tensor, torch.Tensor]:
        """Compute Generalized Advantage Estimation."""
        with torch.no_grad():
            obs_tensor = torch.from_numpy(next_obs).to(self.device)
            _, next_value = self.policy(obs_tensor)
            next_value = next_value.squeeze(-1).cpu()

        advantages = torch.zeros_like(self.rewards)
        lastgaelam = 0

        for t in reversed(range(self.config.num_steps)):
            if t == self.config.num_steps - 1:
                nextnonterminal = 1.0 - self.dones[t]
                nextvalues = next_value
            else:
                nextnonterminal = 1.0 - self.dones[t + 1]
                nextvalues = self.values[t + 1]

            delta = (
                self.rewards[t]
                + self.config.gamma * nextvalues * nextnonterminal
                - self.values[t]
            )
            advantages[t] = lastgaelam = (
                delta + self.config.gamma * self.config.gae_lambda * nextnonterminal * lastgaelam
            )

        returns = advantages + self.values
        return advantages, returns

    def update(self, advantages: torch.Tensor, returns: torch.Tensor) -> dict:
        """Perform PPO update."""
        # Flatten batches
        b_obs = self.obs.reshape((-1,) + self.obs.shape[2:])
        b_actions = self.actions.reshape(-1)
        b_log_probs = self.log_probs.reshape(-1)
        b_advantages = advantages.reshape(-1)
        b_returns = returns.reshape(-1)

        # Normalize advantages
        b_advantages = (b_advantages - b_advantages.mean()) / (b_advantages.std() + 1e-8)

        batch_size = self.config.num_envs * self.config.num_steps
        minibatch_size = batch_size // self.config.num_minibatches

        # Training metrics
        pg_losses = []
        value_losses = []
        entropy_losses = []
        clip_fracs = []

        for _ in range(self.config.update_epochs):
            # Shuffle indices
            indices = torch.randperm(batch_size)

            for start in range(0, batch_size, minibatch_size):
                end = start + minibatch_size
                mb_indices = indices[start:end]

                # Get minibatch
                mb_obs = b_obs[mb_indices].to(self.device)
                mb_actions = b_actions[mb_indices].to(self.device)
                mb_log_probs = b_log_probs[mb_indices].to(self.device)
                mb_advantages = b_advantages[mb_indices].to(self.device)
                mb_returns = b_returns[mb_indices].to(self.device)

                # Forward pass
                action_logits, new_value = self.policy(mb_obs)
                new_value = new_value.squeeze(-1)
                dist = torch.distributions.Categorical(logits=action_logits)
                new_log_prob = dist.log_prob(mb_actions)
                entropy = dist.entropy()

                # Policy loss
                log_ratio = new_log_prob - mb_log_probs
                ratio = log_ratio.exp()
                clip_frac = ((ratio - 1.0).abs() > self.config.clip_coef).float().mean()
                clip_fracs.append(clip_frac.item())

                pg_loss1 = -mb_advantages * ratio
                pg_loss2 = -mb_advantages * torch.clamp(
                    ratio, 1 - self.config.clip_coef, 1 + self.config.clip_coef
                )
                pg_loss = torch.max(pg_loss1, pg_loss2).mean()

                # Value loss
                v_loss = 0.5 * ((new_value - mb_returns) ** 2).mean()

                # Entropy loss
                entropy_loss = entropy.mean()

                # Total loss
                loss = (
                    pg_loss
                    - self.config.ent_coef * entropy_loss
                    + self.config.vf_coef * v_loss
                )

                # Backprop
                self.optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self.policy.parameters(), self.config.max_grad_norm)
                self.optimizer.step()

                pg_losses.append(pg_loss.item())
                value_losses.append(v_loss.item())
                entropy_losses.append(entropy_loss.item())

        return {
            "policy_loss": np.mean(pg_losses),
            "value_loss": np.mean(value_losses),
            "entropy": np.mean(entropy_losses),
            "clip_frac": np.mean(clip_fracs),
        }

    def get_mean_reward(self) -> float:
        """Get mean reward (episode reward if available, else step reward)."""
        if len(self.episode_rewards) > 0:
            return np.mean(self.episode_rewards[-100:])
        elif len(self.step_rewards) > 0:
            return np.mean(self.step_rewards[-500:])
        return 0.0

    def get_action_summary(self) -> str:
        """Get summary of recent actions for logging."""
        if not self.recent_actions:
            return "no actions yet"
        # Count action types
        from collections import Counter
        counts = Counter(self.recent_actions[-20:])
        # Format as "ArrowUp:5, Space:3, ..."
        top_actions = counts.most_common(4)
        return ", ".join(f"{a.split(':')[1]}:{c}" for a, c in top_actions)


def train(config: TrainingConfig) -> Path:
    """Run training loop."""
    print(f"Starting training for: {config.game_url}")
    print(f"Game category: {config.game_category}")
    print(f"Universal actions: {config.use_universal_actions}")
    print(f"Environments: {config.num_envs}, Workers: {config.num_workers}")
    print(f"Device: {config.device}")

    # NOTE: Browser environments must use Serial backend because Playwright's
    # sync API doesn't work inside asyncio loops (which PufferLib's Multiprocessing
    # workers use). For parallel browser training, consider using subprocess-based
    # parallelism or Playwright's async API in a future version.
    if config.num_workers > 1:
        print("Warning: Forcing Serial backend (Playwright incompatible with Multiprocessing)")
    backend = pufferlib.vector.Serial
    # Serial backend requires num_workers=1
    num_workers = 1

    # Create environment factory
    env_fn = make_env(
        game_url=config.game_url,
        game_category=config.game_category,
        use_universal_actions=config.use_universal_actions,
        headless=True,  # Always headless during training
    )

    # Create vectorized environments
    vecenv = pufferlib.vector.make(
        env_fn,
        backend=backend,
        num_envs=config.num_envs,
        num_workers=num_workers,
    )

    # Create policy
    obs_shape = vecenv.single_observation_space.shape
    num_actions = vecenv.single_action_space.n
    policy = GameCNNPolicy(obs_shape, num_actions)

    # Get action map for human-readable logging
    from ..games.registry import get_game_config, get_universal_config
    if config.use_universal_actions:
        game_config = get_universal_config()
    else:
        game_config = get_game_config(config.game_category)
    action_map = game_config.action_map

    print(f"Observation shape: {obs_shape}")
    print(f"Action space size: {num_actions}")
    print(f"Actions: {[f'{v[1]}' for v in list(action_map.values())[:7]]}{'...' if len(action_map) > 7 else ''}")

    # Setup output directory
    output_path = Path(config.output_dir) / config.experiment_name
    output_path.mkdir(parents=True, exist_ok=True)

    # Initialize trainer
    trainer = PPOTrainer(config, vecenv, policy, action_map=action_map)

    # Initialize W&B if enabled
    if config.use_wandb:
        try:
            import wandb

            wandb.init(
                project="denethor-rl",
                name=config.experiment_name,
                config=vars(config),
            )
        except ImportError:
            print("Warning: wandb not installed, disabling logging")
            config.use_wandb = False

    # Initial reset (this can take a while as browsers start up)
    print("\nInitializing environments (starting browsers)...")
    obs, _ = vecenv.reset()
    print("Environments ready!")

    print("\nTraining started...")
    print("=" * 50)
    print("(Each rollout collects {} steps across {} envs)".format(
        config.num_steps, config.num_envs
    ))

    import time
    rollout_count = 0

    try:
        while trainer.global_step < config.total_timesteps:
            rollout_start = time.time()
            rollout_count += 1

            # Collect rollout
            print(f"\rRollout {rollout_count}: collecting {config.num_steps} steps...", end="", flush=True)
            obs = trainer.collect_rollout(obs)

            # Compute advantages
            advantages, returns = trainer.compute_gae(obs)

            # Update policy
            metrics = trainer.update(advantages, returns)

            rollout_time = time.time() - rollout_start
            steps_per_sec = (config.num_steps * config.num_envs) / rollout_time

            # Logging - always log after each rollout for browser envs (they're slow)
            mean_reward = trainer.get_mean_reward()
            action_summary = trainer.get_action_summary()
            print(
                f"\rStep {trainer.global_step:,}/{config.total_timesteps:,} | "
                f"Reward: {mean_reward:.3f} | "
                f"Actions: [{action_summary}] | "
                f"Speed: {steps_per_sec:.1f} sps | "
                f"Loss: {metrics['policy_loss']:.4f}"
            )

            if config.use_wandb:
                import wandb

                wandb.log(
                    {
                        "step": trainer.global_step,
                        "mean_reward": mean_reward,
                        **metrics,
                    }
                )

            # Save checkpoint
            if trainer.global_step % config.save_interval < config.num_envs * config.num_steps:
                checkpoint_path = output_path / f"checkpoint_{trainer.global_step}.pt"
                torch.save(
                    {
                        "policy_state_dict": policy.state_dict(),
                        "optimizer_state_dict": trainer.optimizer.state_dict(),
                        "global_step": trainer.global_step,
                        "config": vars(config),
                    },
                    checkpoint_path,
                )
                print(f"Saved checkpoint: {checkpoint_path}")

    except KeyboardInterrupt:
        print("\nTraining interrupted by user")
    finally:
        vecenv.close()

    # Save final model
    final_path = output_path / "final_policy.pt"
    torch.save(
        {
            "policy_state_dict": policy.state_dict(),
            "config": vars(config),
            "final_step": trainer.global_step,
        },
        final_path,
    )
    print(f"\nTraining complete! Final model: {final_path}")

    if config.use_wandb:
        import wandb

        wandb.finish()

    return final_path


def main():
    parser = argparse.ArgumentParser(description="Train RL agent for browser games")

    # Required
    parser.add_argument("game_url", help="URL of the game to train on")

    # Game config
    parser.add_argument(
        "--game-category",
        default="arcade",
        choices=list_game_categories(),
        help="Game category for action space",
    )
    parser.add_argument(
        "--universal-actions",
        action="store_true",
        help="Use universal action space (experimental)",
    )

    # Training
    parser.add_argument("--timesteps", type=int, default=100_000)
    parser.add_argument("--num-envs", type=int, default=4)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--num-steps", type=int, default=128)

    # Output
    parser.add_argument("--output-dir", default="outputs")
    parser.add_argument("--experiment-name", default="browser_game")
    parser.add_argument("--wandb", action="store_true", help="Enable W&B logging")

    # Device
    parser.add_argument(
        "--device",
        default="cuda" if torch.cuda.is_available() else "cpu",
        help="Device to use for training",
    )

    args = parser.parse_args()

    config = TrainingConfig(
        game_url=args.game_url,
        game_category=args.game_category,
        use_universal_actions=args.universal_actions,
        total_timesteps=args.timesteps,
        num_envs=args.num_envs,
        num_workers=args.num_workers,
        learning_rate=args.lr,
        num_steps=args.num_steps,
        output_dir=args.output_dir,
        experiment_name=args.experiment_name,
        use_wandb=args.wandb,
        device=args.device,
    )

    train(config)


if __name__ == "__main__":
    main()
