"""
Game-specific browser environment with configurable action spaces.
"""

from typing import Optional

import numpy as np

from ..games.registry import GameCategory, get_game_config, get_universal_config
from .base_browser_env import BaseBrowserEnv


class BrowserGameEnv(BaseBrowserEnv):
    """
    Browser game environment with game-type-specific action spaces.

    Usage:
        # With game category
        env = BrowserGameEnv(
            game_url="https://example.com/tetris",
            game_category="puzzle",
        )

        # With universal action space (experimental)
        env = BrowserGameEnv(
            game_url="https://example.com/game",
            use_universal_actions=True,
        )

        # Headed mode for visualization
        env = BrowserGameEnv(
            game_url="https://example.com/game",
            game_category="arcade",
            headless=False,  # <-- Shows browser window
        )
    """

    def __init__(
        self,
        game_url: str,
        game_category: Optional[GameCategory | str] = None,
        use_universal_actions: bool = False,
        headless: bool = True,
        render_mode: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            game_url=game_url,
            headless=headless,
            render_mode=render_mode,
            **kwargs,
        )

        # Get game configuration
        if use_universal_actions:
            self.game_config = get_universal_config()
        elif game_category:
            self.game_config = get_game_config(game_category)
        else:
            # Default to arcade
            self.game_config = get_game_config(GameCategory.ARCADE)

        # Set action space from config
        self.action_space = self.game_config.action_space
        self._action_map = self.game_config.action_map

        # For tracking screen changes (basic reward signal)
        self._prev_obs: Optional[np.ndarray] = None

    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None):
        obs, info = super().reset(seed=seed, options=options)
        self._prev_obs = obs.copy()
        info["game_category"] = self.game_config.category.value
        info["control_hints"] = self.game_config.control_hints
        return obs, info

    async def _execute_action_async(self, action: int):
        """Execute action based on game config action map (async)."""
        if action not in self._action_map:
            return  # Invalid action, do nothing

        action_type, action_value = self._action_map[action]

        if action_type == "keyboard":
            await self._page.keyboard.press(action_value)

        elif action_type == "click":
            if isinstance(action_value, tuple):
                # Normalized coordinates (0-1) -> pixel coordinates
                x = int(action_value[0] * self.viewport_width)
                y = int(action_value[1] * self.viewport_height)
                await self._page.mouse.click(x, y)
            elif action_value == "center":
                await self._page.mouse.click(
                    self.viewport_width // 2, self.viewport_height // 2
                )

        elif action_type == "wait":
            await self._page.wait_for_timeout(action_value)

    def _compute_reward(self, obs: np.ndarray) -> float:
        """
        Default reward: screen change magnitude.
        Override with game-specific reward functions for better training.
        """
        if self._prev_obs is None:
            self._prev_obs = obs.copy()
            return 0.0

        # Compute normalized pixel difference
        diff = np.abs(obs.astype(np.float32) - self._prev_obs.astype(np.float32))
        change_ratio = np.mean(diff) / 255.0

        self._prev_obs = obs.copy()

        # Small reward for screen changes (agent is doing something)
        # Scale to roughly -1 to 1 range
        return float(change_ratio * 2.0 - 0.1)  # Slight penalty for no change
