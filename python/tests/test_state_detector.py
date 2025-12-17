"""Tests for state detector."""

from unittest.mock import MagicMock

from denethor_rl.utils.state_detector import (
    GameState,
    detect_state,
    get_state_name,
    LOADING_PATTERNS,
    MENU_PATTERNS,
    GAME_OVER_PATTERNS,
    PAUSED_PATTERNS,
)


class TestGameState:
    """Test GameState enum."""

    def test_game_state_values(self):
        """Test that GameState has expected values."""
        assert GameState.LOADING == 0
        assert GameState.MENU == 1
        assert GameState.PLAYING == 2
        assert GameState.PAUSED == 3
        assert GameState.GAME_OVER == 4
        assert GameState.UNKNOWN == 5

    def test_game_state_is_int_enum(self):
        """Test that GameState can be used as int."""
        # IntEnum allows comparison with ints
        assert GameState.LOADING == 0
        assert int(GameState.PLAYING) == 2

    def test_all_states_exist(self):
        """Test all expected states exist."""
        states = list(GameState)
        assert len(states) == 6
        assert GameState.LOADING in states
        assert GameState.MENU in states
        assert GameState.PLAYING in states
        assert GameState.PAUSED in states
        assert GameState.GAME_OVER in states
        assert GameState.UNKNOWN in states


class TestGetStateName:
    """Test get_state_name function."""

    def test_get_state_name_loading(self):
        """Test getting name for LOADING state."""
        assert get_state_name(GameState.LOADING) == "LOADING"

    def test_get_state_name_menu(self):
        """Test getting name for MENU state."""
        assert get_state_name(GameState.MENU) == "MENU"

    def test_get_state_name_playing(self):
        """Test getting name for PLAYING state."""
        assert get_state_name(GameState.PLAYING) == "PLAYING"

    def test_get_state_name_paused(self):
        """Test getting name for PAUSED state."""
        assert get_state_name(GameState.PAUSED) == "PAUSED"

    def test_get_state_name_game_over(self):
        """Test getting name for GAME_OVER state."""
        assert get_state_name(GameState.GAME_OVER) == "GAME_OVER"

    def test_get_state_name_unknown(self):
        """Test getting name for UNKNOWN state."""
        assert get_state_name(GameState.UNKNOWN) == "UNKNOWN"


class TestPatterns:
    """Test pattern lists are properly defined."""

    def test_loading_patterns_not_empty(self):
        """Test LOADING_PATTERNS is not empty."""
        assert len(LOADING_PATTERNS) > 0

    def test_menu_patterns_not_empty(self):
        """Test MENU_PATTERNS is not empty."""
        assert len(MENU_PATTERNS) > 0

    def test_game_over_patterns_not_empty(self):
        """Test GAME_OVER_PATTERNS is not empty."""
        assert len(GAME_OVER_PATTERNS) > 0

    def test_paused_patterns_not_empty(self):
        """Test PAUSED_PATTERNS is not empty."""
        assert len(PAUSED_PATTERNS) > 0

    def test_loading_patterns_contains_expected(self):
        """Test LOADING_PATTERNS contains expected patterns."""
        assert r"loading" in LOADING_PATTERNS
        assert r"please wait" in LOADING_PATTERNS

    def test_menu_patterns_contains_expected(self):
        """Test MENU_PATTERNS contains expected patterns."""
        assert r"start" in MENU_PATTERNS
        assert r"play" in MENU_PATTERNS
        assert r"new game" in MENU_PATTERNS

    def test_game_over_patterns_contains_expected(self):
        """Test GAME_OVER_PATTERNS contains expected patterns."""
        assert r"game over" in GAME_OVER_PATTERNS
        assert r"you win" in GAME_OVER_PATTERNS
        assert r"restart" in GAME_OVER_PATTERNS

    def test_paused_patterns_contains_expected(self):
        """Test PAUSED_PATTERNS contains expected patterns."""
        assert r"paused" in PAUSED_PATTERNS
        assert r"resume" in PAUSED_PATTERNS


class TestDetectState:
    """Test detect_state function."""

    def _create_mock_page(
        self,
        has_canvas: bool = False,
        has_game_container: bool = False,
        text_matches: dict = None,
        viewport_size: dict = None,
    ) -> MagicMock:
        """Create a mock Playwright page."""
        page = MagicMock()

        # Default viewport
        page.viewport_size = viewport_size or {"width": 1280, "height": 720}

        # Set up locator mock
        def locator_side_effect(selector):
            loc = MagicMock()

            # Handle canvas selector
            if selector == "canvas":
                loc.count.return_value = 1 if has_canvas else 0
                return loc

            # Handle game container selectors
            if selector in ["#game", "#gameContainer", ".game-container", "[data-game]"]:
                loc.count.return_value = 1 if has_game_container else 0
                return loc

            # Handle text pattern selectors (text=/pattern/i)
            if selector.startswith("text=/"):
                pattern = selector[6:-2]  # Extract pattern from text=/pattern/i
                if text_matches and pattern in text_matches:
                    match_data = text_matches[pattern]
                    loc.count.return_value = match_data.get("count", 0)

                    # Set up nth mock for prominent overlay check
                    def nth_side_effect(idx):
                        elem = MagicMock()
                        elem.is_visible.return_value = match_data.get("visible", True)
                        elem.bounding_box.return_value = match_data.get(
                            "box", {"x": 500, "y": 300, "width": 200, "height": 50}
                        )
                        parent = MagicMock()
                        parent.bounding_box.return_value = {"width": 300, "height": 100}
                        elem.locator.return_value = parent
                        return elem

                    loc.nth = nth_side_effect
                else:
                    loc.count.return_value = 0
                return loc

            loc.count.return_value = 0
            return loc

        page.locator.side_effect = locator_side_effect
        return page

    def test_detect_state_with_canvas_returns_playing(self):
        """When canvas exists and no overlays, returns PLAYING."""
        page = self._create_mock_page(has_canvas=True)
        state = detect_state(page)
        assert state == GameState.PLAYING

    def test_detect_state_with_game_container_returns_playing(self):
        """When game container exists and no overlays, returns PLAYING."""
        page = self._create_mock_page(has_game_container=True)
        state = detect_state(page)
        assert state == GameState.PLAYING

    def test_detect_state_returns_unknown_for_empty_page(self):
        """When nothing found, returns UNKNOWN."""
        page = self._create_mock_page()
        state = detect_state(page)
        assert state == GameState.UNKNOWN

    def test_detect_state_handles_exception(self):
        """When exception occurs, returns UNKNOWN."""
        page = MagicMock()
        page.locator.side_effect = Exception("Network error")
        state = detect_state(page)
        assert state == GameState.UNKNOWN

    def test_detect_state_menu_without_game(self):
        """When menu pattern found and no game, returns MENU."""
        page = self._create_mock_page(
            has_canvas=False,
            text_matches={
                "start": {"count": 1, "visible": True},
            },
        )
        state = detect_state(page)
        assert state == GameState.MENU


class TestProgressDetector:
    """Test progress detector functionality."""

    def test_progress_info_default_values(self):
        """Test ProgressInfo has correct default values."""
        from denethor_rl.utils.progress_detector import ProgressInfo

        info = ProgressInfo()
        assert info.score is None
        assert info.level is None
        assert info.health is None
        assert info.lives is None
        assert info.time_remaining is None
        assert info.raw_indicators == {}

    def test_progress_info_with_values(self):
        """Test ProgressInfo with values."""
        from denethor_rl.utils.progress_detector import ProgressInfo

        info = ProgressInfo(score=100, level=5, health=0.75, lives=3)
        assert info.score == 100
        assert info.level == 5
        assert info.health == 0.75
        assert info.lives == 3
