"""
Evaluate trained agent with visualization (headed browser).
"""

import argparse
import time

import numpy as np
import torch

from ..envs.game_env import BrowserGameEnv
from ..policies.cnn_policy import GameCNNPolicy
from ..games.registry import list_game_categories


def evaluate(
    game_url: str,
    model_path: str,
    game_category: str = "arcade",
    use_universal_actions: bool = False,
    num_episodes: int = 3,
    delay_ms: int = 100,
    max_steps: int = 1000,
):
    """
    Run trained agent with visible browser.

    Args:
        game_url: Game URL
        model_path: Path to saved model checkpoint
        game_category: Game category
        use_universal_actions: Use universal action space
        num_episodes: Number of episodes to run
        delay_ms: Delay between actions (for human viewing)
        max_steps: Maximum steps per episode
    """
    print(f"Loading model from: {model_path}")
    print(f"Game: {game_url}")
    print(f"Category: {game_category}")

    # Create environment (headed mode!)
    env = BrowserGameEnv(
        game_url=game_url,
        game_category=game_category,
        use_universal_actions=use_universal_actions,
        headless=False,  # <-- HEADED MODE
        render_mode="human",
        max_steps=max_steps,
    )

    # Load policy
    obs_shape = env.observation_space.shape
    num_actions = env.action_space.n
    policy = GameCNNPolicy(obs_shape, num_actions)

    # Load checkpoint
    checkpoint = torch.load(model_path, map_location="cpu")

    # Handle both old format (direct state_dict) and new format (with metadata)
    if "policy_state_dict" in checkpoint:
        policy.load_state_dict(checkpoint["policy_state_dict"])
        print(f"Loaded checkpoint from step {checkpoint.get('global_step', 'unknown')}")
    else:
        policy.load_state_dict(checkpoint)

    policy.eval()

    print(f"\nControl hints: {env.game_config.control_hints}")
    print(f"Action space size: {num_actions}")
    print(f"\nStarting evaluation ({num_episodes} episodes)...")
    print("=" * 50)

    total_rewards = []
    total_steps = []

    try:
        for episode in range(num_episodes):
            obs, info = env.reset()
            episode_reward = 0
            step = 0

            print(f"\nEpisode {episode + 1}/{num_episodes}")

            while True:
                # Get action from policy
                obs_tensor = torch.from_numpy(obs).unsqueeze(0)
                with torch.no_grad():
                    action_logits, value = policy(obs_tensor)
                    # Use greedy action selection during evaluation
                    action = action_logits.argmax(dim=1).item()

                # Execute action
                obs, reward, terminated, truncated, info = env.step(action)
                episode_reward += reward
                step += 1

                # Slow down for human viewing
                time.sleep(delay_ms / 1000)

                if terminated or truncated:
                    break

            total_rewards.append(episode_reward)
            total_steps.append(step)
            print(f"  Steps: {step}, Reward: {episode_reward:.2f}")

    except KeyboardInterrupt:
        print("\nEvaluation interrupted by user")
    finally:
        env.close()

    print("\n" + "=" * 50)
    if total_rewards:
        print(f"Episodes completed: {len(total_rewards)}")
        print(f"Average reward: {np.mean(total_rewards):.2f} (+/- {np.std(total_rewards):.2f})")
        print(f"Average steps: {np.mean(total_steps):.1f}")
        print(f"Min/Max reward: {np.min(total_rewards):.2f} / {np.max(total_rewards):.2f}")


def evaluate_random(
    game_url: str,
    game_category: str = "arcade",
    use_universal_actions: bool = False,
    num_episodes: int = 3,
    delay_ms: int = 100,
    max_steps: int = 1000,
):
    """
    Run random agent with visible browser (baseline comparison).

    Args:
        game_url: Game URL
        game_category: Game category
        use_universal_actions: Use universal action space
        num_episodes: Number of episodes to run
        delay_ms: Delay between actions (for human viewing)
        max_steps: Maximum steps per episode
    """
    print("Running RANDOM agent baseline")
    print(f"Game: {game_url}")
    print(f"Category: {game_category}")

    # Create environment (headed mode!)
    env = BrowserGameEnv(
        game_url=game_url,
        game_category=game_category,
        use_universal_actions=use_universal_actions,
        headless=False,  # <-- HEADED MODE
        render_mode="human",
        max_steps=max_steps,
    )

    num_actions = env.action_space.n
    print(f"\nControl hints: {env.game_config.control_hints}")
    print(f"Action space size: {num_actions}")
    print(f"\nStarting random agent ({num_episodes} episodes)...")
    print("=" * 50)

    total_rewards = []
    total_steps = []

    try:
        for episode in range(num_episodes):
            obs, info = env.reset()
            episode_reward = 0
            step = 0

            print(f"\nEpisode {episode + 1}/{num_episodes}")

            while True:
                # Random action
                action = env.action_space.sample()

                # Execute action
                obs, reward, terminated, truncated, info = env.step(action)
                episode_reward += reward
                step += 1

                # Slow down for human viewing
                time.sleep(delay_ms / 1000)

                if terminated or truncated:
                    break

            total_rewards.append(episode_reward)
            total_steps.append(step)
            print(f"  Steps: {step}, Reward: {episode_reward:.2f}")

    except KeyboardInterrupt:
        print("\nEvaluation interrupted by user")
    finally:
        env.close()

    print("\n" + "=" * 50)
    if total_rewards:
        print(f"Episodes completed: {len(total_rewards)}")
        print(f"Average reward: {np.mean(total_rewards):.2f} (+/- {np.std(total_rewards):.2f})")
        print(f"Average steps: {np.mean(total_steps):.1f}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained agent (headed mode)")
    parser.add_argument("game_url", help="URL of the game")
    parser.add_argument(
        "model_path",
        nargs="?",
        default=None,
        help="Path to trained model checkpoint (omit for random baseline)",
    )
    parser.add_argument(
        "--game-category", default="arcade", choices=list_game_categories()
    )
    parser.add_argument("--universal-actions", action="store_true")
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--delay", type=int, default=100, help="Delay between actions (ms)")
    parser.add_argument("--max-steps", type=int, default=1000, help="Max steps per episode")
    parser.add_argument(
        "--random", action="store_true", help="Run random agent instead of trained model"
    )

    args = parser.parse_args()

    if args.random or args.model_path is None:
        evaluate_random(
            game_url=args.game_url,
            game_category=args.game_category,
            use_universal_actions=args.universal_actions,
            num_episodes=args.episodes,
            delay_ms=args.delay,
            max_steps=args.max_steps,
        )
    else:
        evaluate(
            game_url=args.game_url,
            model_path=args.model_path,
            game_category=args.game_category,
            use_universal_actions=args.universal_actions,
            num_episodes=args.episodes,
            delay_ms=args.delay,
            max_steps=args.max_steps,
        )


if __name__ == "__main__":
    main()
