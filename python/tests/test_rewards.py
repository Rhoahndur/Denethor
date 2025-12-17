"""Tests for reward functions."""

import numpy as np
import pytest

from denethor_rl.rewards.base import (
    RewardFunction,
    DefaultReward,
    get_reward_function,
    list_reward_functions,
    register_reward,
)
from denethor_rl.utils.state_detector import GameState
from denethor_rl.utils.progress_detector import ProgressInfo, compute_progress_reward


class TestProgressReward:
    """Test compute_progress_reward function."""

    def test_no_previous_progress(self):
        """Returns 0 when no previous progress."""
        current = ProgressInfo(score=100)
        reward = compute_progress_reward(current, None)
        assert reward == 0.0

    def test_score_increase_gives_positive_reward(self):
        """Score increase gives positive reward."""
        previous = ProgressInfo(score=0)
        current = ProgressInfo(score=50)
        reward = compute_progress_reward(current, previous)
        assert reward > 0
        assert reward == 0.5  # 50/100 = 0.5, capped at 0.5

    def test_score_increase_capped_at_05(self):
        """Score increase reward is capped at 0.5."""
        previous = ProgressInfo(score=0)
        current = ProgressInfo(score=1000)
        reward = compute_progress_reward(current, previous)
        assert reward == 0.5  # Capped

    def test_score_decrease_gives_negative_reward(self):
        """Score decrease gives negative reward."""
        previous = ProgressInfo(score=100)
        current = ProgressInfo(score=50)
        reward = compute_progress_reward(current, previous)
        assert reward < 0
        assert reward == -0.1

    def test_level_increase_gives_reward(self):
        """Level increase gives positive reward."""
        previous = ProgressInfo(level=1)
        current = ProgressInfo(level=2)
        reward = compute_progress_reward(current, previous)
        assert reward == 1.0

    def test_multiple_level_increase(self):
        """Multiple level increase gives proportional reward."""
        previous = ProgressInfo(level=1)
        current = ProgressInfo(level=3)
        reward = compute_progress_reward(current, previous)
        # 2 levels * 1.0 = 2.0, but clamped to 1.0
        assert reward == 1.0  # Clamped

    def test_health_decrease_gives_negative_reward(self):
        """Health decrease gives negative reward."""
        previous = ProgressInfo(health=1.0)
        current = ProgressInfo(health=0.5)
        reward = compute_progress_reward(current, previous)
        assert reward < 0
        assert reward == -0.25  # -0.5 * 0.5

    def test_health_increase_gives_positive_reward(self):
        """Health increase gives positive reward."""
        previous = ProgressInfo(health=0.5)
        current = ProgressInfo(health=1.0)
        reward = compute_progress_reward(current, previous)
        assert reward > 0
        assert reward == 0.25  # 0.5 * 0.5

    def test_lives_decrease_gives_negative_reward(self):
        """Losing lives gives negative reward."""
        previous = ProgressInfo(lives=3)
        current = ProgressInfo(lives=2)
        reward = compute_progress_reward(current, previous)
        assert reward < 0
        assert reward == -0.5

    def test_combined_progress(self):
        """Combined score and level progress."""
        previous = ProgressInfo(score=0, level=1)
        current = ProgressInfo(score=50, level=2)
        reward = compute_progress_reward(current, previous)
        # score: 50/100 = 0.5, level: 1.0 -> total 1.5, clamped to 1.0
        assert reward == 1.0

    def test_none_values_ignored(self):
        """None values in progress are ignored."""
        previous = ProgressInfo(score=None, level=1)
        current = ProgressInfo(score=100, level=2)
        reward = compute_progress_reward(current, previous)
        # Only level contributes since previous.score is None
        assert reward == 1.0


class TestRewardRegistry:
    """Test reward function registry."""

    def test_list_reward_functions(self):
        """Test listing available reward functions."""
        funcs = list_reward_functions()
        assert "default" in funcs

    def test_get_default_reward(self):
        """Test getting default reward function."""
        reward_fn = get_reward_function("default")
        assert isinstance(reward_fn, DefaultReward)

    def test_get_unknown_reward_raises(self):
        """Test getting unknown reward function raises."""
        with pytest.raises(ValueError, match="Unknown reward function"):
            get_reward_function("nonexistent")

    def test_register_custom_reward(self):
        """Test registering custom reward function."""

        class CustomReward(RewardFunction):
            def compute(self, obs, page, action, terminated, truncated):
                return 0.42

        register_reward("custom_test", CustomReward)
        assert "custom_test" in list_reward_functions()

        reward_fn = get_reward_function("custom_test")
        assert isinstance(reward_fn, CustomReward)


class TestDefaultReward:
    """Test DefaultReward class."""

    def test_reset_clears_state(self):
        """Test reset clears internal state."""
        reward_fn = DefaultReward()
        reward_fn._prev_obs = np.zeros((240, 320, 3), dtype=np.uint8)
        reward_fn._prev_state = GameState.PLAYING
        reward_fn._prev_progress = ProgressInfo(score=100)

        reward_fn.reset()

        assert reward_fn._prev_obs is None
        assert reward_fn._prev_state is None
        assert reward_fn._prev_progress is None

    def test_init_with_progress_detection_disabled(self):
        """Test initializing with progress detection disabled."""
        reward_fn = DefaultReward(use_progress_detection=False)
        assert reward_fn.use_progress_detection is False

    def test_init_with_progress_detection_enabled(self):
        """Test initializing with progress detection enabled."""
        reward_fn = DefaultReward(use_progress_detection=True)
        assert reward_fn.use_progress_detection is True


class TestRewardFunctionBase:
    """Test RewardFunction base class."""

    def test_cannot_instantiate_abstract(self):
        """Test that abstract base class cannot be instantiated."""
        with pytest.raises(TypeError):
            RewardFunction()

    def test_subclass_must_implement_compute(self):
        """Test that subclass must implement compute method."""

        class IncompleteReward(RewardFunction):
            pass

        with pytest.raises(TypeError):
            IncompleteReward()

    def test_subclass_with_compute_works(self):
        """Test that subclass with compute method works."""

        class CompleteReward(RewardFunction):
            def compute(self, obs, page, action, terminated, truncated):
                return 0.5

        reward_fn = CompleteReward()
        assert reward_fn is not None
        assert reward_fn.compute(None, None, 0, False, False) == 0.5
