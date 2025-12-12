"""Policy networks for RL training."""

from .cnn_policy import GameCNNPolicy, create_policy

__all__ = ["GameCNNPolicy", "create_policy"]
