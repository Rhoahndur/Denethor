"""Tests for browser game environments."""

import numpy as np
import pytest

from denethor_rl.envs import BrowserGameEnv
from denethor_rl.games import GameCategory, get_game_config, list_game_categories


class TestGameRegistry:
    """Test game registry functionality."""

    def test_list_game_categories(self):
        """Test that we can list all game categories."""
        categories = list_game_categories()
        assert len(categories) >= 10
        assert "arcade" in categories
        assert "platformer" in categories
        assert "puzzle" in categories

    def test_get_game_config_by_string(self):
        """Test getting config by string name."""
        config = get_game_config("arcade")
        assert config.category == GameCategory.ARCADE
        assert config.action_space.n == 7

    def test_get_game_config_by_enum(self):
        """Test getting config by enum."""
        config = get_game_config(GameCategory.PLATFORMER)
        assert config.category == GameCategory.PLATFORMER
        assert len(config.control_hints) > 0

    def test_action_maps_have_valid_format(self):
        """Test that all action maps have valid format."""
        for category in GameCategory:
            config = get_game_config(category)
            for action_id, action_def in config.action_map.items():
                assert isinstance(action_id, int)
                assert isinstance(action_def, tuple)
                assert len(action_def) == 2
                action_type, action_value = action_def
                assert action_type in ("keyboard", "click", "wait")


class TestBrowserGameEnv:
    """Test BrowserGameEnv without actually launching browser."""

    def test_env_instantiation(self):
        """Test that environment can be instantiated."""
        env = BrowserGameEnv(
            game_url="https://example.com/game",
            game_category="arcade",
            headless=True,
        )
        assert env.game_url == "https://example.com/game"
        assert env.action_space.n == 7
        assert env.observation_space.shape == (240, 320, 3)
        env.close()

    def test_env_with_custom_resolution(self):
        """Test environment with custom resolution preset."""
        env = BrowserGameEnv(
            game_url="https://example.com/game",
            game_category="arcade",
            resolution="fast",
        )
        assert env.observation_space.shape == (120, 160, 3)
        env.close()

    def test_env_with_explicit_resolution(self):
        """Test environment with explicit resolution override."""
        env = BrowserGameEnv(
            game_url="https://example.com/game",
            game_category="arcade",
            obs_height=100,
            obs_width=200,
        )
        assert env.observation_space.shape == (100, 200, 3)
        env.close()

    def test_env_universal_actions(self):
        """Test environment with universal action space."""
        env = BrowserGameEnv(
            game_url="https://example.com/game",
            use_universal_actions=True,
        )
        assert env.action_space.n == 46  # Universal has 46 actions
        env.close()

    def test_env_different_categories(self):
        """Test environment with different game categories."""
        expected_sizes = {
            "arcade": 7,
            "platformer": 7,
            "puzzle": 7,
            "point_and_click": 25,
            "racing": 5,
            "rhythm": 6,
        }
        for category, expected_n in expected_sizes.items():
            env = BrowserGameEnv(
                game_url="https://example.com/game",
                game_category=category,
            )
            assert env.action_space.n == expected_n, f"Failed for {category}"
            env.close()


@pytest.mark.slow
class TestBrowserGameEnvIntegration:
    """Integration tests that actually launch browser (marked slow)."""

    def test_env_reset_step_close(self):
        """Test basic environment lifecycle with real browser."""
        env = BrowserGameEnv(
            game_url="https://example.com",
            game_category="arcade",
            headless=True,
            max_steps=10,
        )

        # Reset
        obs, info = env.reset()
        assert obs.shape == (240, 320, 3)
        assert obs.dtype == np.uint8
        assert "steps" in info
        # Note: url not in info - PufferLib requires numeric values only

        # Step
        for _ in range(5):
            obs, reward, terminated, truncated, info = env.step(0)
            assert obs.shape == (240, 320, 3)
            assert isinstance(reward, float)
            assert isinstance(terminated, bool)
            assert isinstance(truncated, bool)

        # Close
        env.close()
