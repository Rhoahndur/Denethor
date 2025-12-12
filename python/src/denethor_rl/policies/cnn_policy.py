"""
CNN policy network for screenshot-based game playing.
"""

import torch
import torch.nn as nn


class GameCNNPolicy(nn.Module):
    """
    CNN policy for browser game screenshots.

    Architecture:
    - 3 conv layers with ReLU
    - Flatten
    - 2 FC layers
    - Actor (action logits) + Critic (value) heads
    """

    def __init__(self, observation_shape: tuple, num_actions: int):
        super().__init__()

        # Input: (batch, H, W, 3) -> need (batch, 3, H, W)
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=8, stride=4),
            nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=4, stride=2),
            nn.ReLU(),
            nn.Conv2d(64, 64, kernel_size=3, stride=1),
            nn.ReLU(),
            nn.Flatten(),
        )

        # Calculate CNN output size
        with torch.no_grad():
            # observation_shape is (H, W, C) = (240, 320, 3)
            h, w, c = observation_shape
            sample = torch.zeros(1, c, h, w)
            cnn_out_size = self.cnn(sample).shape[1]

        # Fully connected layers
        self.fc = nn.Sequential(
            nn.Linear(cnn_out_size, 512),
            nn.ReLU(),
        )

        # Actor-Critic heads
        self.actor = nn.Linear(512, num_actions)
        self.critic = nn.Linear(512, 1)

        self.num_actions = num_actions

    def forward(self, obs):
        """
        Forward pass.

        Args:
            obs: Observation tensor, shape (batch, H, W, C) uint8

        Returns:
            action_logits: (batch, num_actions)
            value: (batch, 1)
        """
        # Normalize and transpose: (B, H, W, C) -> (B, C, H, W)
        x = obs.float() / 255.0
        x = x.permute(0, 3, 1, 2)

        # CNN + FC
        features = self.fc(self.cnn(x))

        # Heads
        action_logits = self.actor(features)
        value = self.critic(features)

        return action_logits, value


def create_policy(env) -> nn.Module:
    """Create policy network from environment."""
    obs_shape = env.single_observation_space.shape
    num_actions = env.single_action_space.n
    return GameCNNPolicy(obs_shape, num_actions)
