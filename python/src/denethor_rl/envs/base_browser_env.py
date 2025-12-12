"""
Base browser environment for PufferLib training.
Handles Playwright browser lifecycle and screenshot capture.
"""

import io
from typing import Optional

import gymnasium as gym
import numpy as np
from PIL import Image
from playwright.sync_api import Browser, Page, sync_playwright


class BaseBrowserEnv(gym.Env):
    """
    Base Gymnasium environment for browser-based games.

    Observations: RGB screenshot (configurable resolution)
    Actions: Defined by subclass or action_space parameter
    """

    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 10}

    # Resolution presets (height, width)
    RESOLUTION_PRESETS = {
        "fast": (120, 160),  # 160x120 - fastest, low precision
        "default": (240, 320),  # 320x240 - good balance
        "precise": (360, 480),  # 480x360 - high precision games (Snake, etc.)
        "high": (480, 640),  # 640x480 - maximum detail
    }

    def __init__(
        self,
        game_url: str,
        headless: bool = True,
        render_mode: Optional[str] = None,
        viewport_width: int = 1280,
        viewport_height: int = 720,
        max_steps: int = 1000,
        resolution: str = "default",  # "fast", "default", "precise", "high"
        obs_height: Optional[int] = None,  # Override preset
        obs_width: Optional[int] = None,  # Override preset
    ):
        super().__init__()

        self.game_url = game_url
        self.headless = headless
        self.render_mode = render_mode
        self.viewport_width = viewport_width
        self.viewport_height = viewport_height
        self.max_steps = max_steps

        # Set observation resolution
        if obs_height and obs_width:
            self.obs_height, self.obs_width = obs_height, obs_width
        else:
            self.obs_height, self.obs_width = self.RESOLUTION_PRESETS.get(
                resolution, self.RESOLUTION_PRESETS["default"]
            )

        # Observation space: RGB screenshot at configured resolution
        self.observation_space = gym.spaces.Box(
            low=0, high=255, shape=(self.obs_height, self.obs_width, 3), dtype=np.uint8
        )

        # Action space: must be defined by subclass
        self.action_space = None  # Override in subclass

        # Browser state (lazy initialization)
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._page: Optional[Page] = None
        self._steps = 0

    def _ensure_browser(self):
        """Lazy browser initialization."""
        if self._page is not None:
            return

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-extensions",
            ],
        )
        self._page = self._browser.new_page(
            viewport={"width": self.viewport_width, "height": self.viewport_height}
        )

    def reset(
        self, seed: Optional[int] = None, options: Optional[dict] = None
    ) -> tuple[np.ndarray, dict]:
        super().reset(seed=seed)

        self._ensure_browser()

        # Navigate to game
        self._page.goto(self.game_url, wait_until="domcontentloaded")
        self._steps = 0

        # Wait for initial load
        self._page.wait_for_timeout(2000)

        obs = self._get_observation()
        info = {"steps": 0, "url": self.game_url}

        return obs, info

    def step(self, action: int) -> tuple[np.ndarray, float, bool, bool, dict]:
        self._steps += 1

        # Execute action (subclass implements this)
        self._execute_action(action)

        # Small delay for game to respond
        self._page.wait_for_timeout(50)

        # Get observation
        obs = self._get_observation()

        # Compute reward (subclass can override)
        reward = self._compute_reward(obs)

        # Check termination
        terminated = self._check_terminated()
        truncated = self._steps >= self.max_steps

        info = {
            "steps": self._steps,
            "action": action,
        }

        return obs, reward, terminated, truncated, info

    def _execute_action(self, action: int):
        """Execute action. Override in subclass."""
        raise NotImplementedError("Subclass must implement _execute_action")

    def _compute_reward(self, obs: np.ndarray) -> float:
        """Compute reward. Override in subclass for game-specific rewards."""
        return 0.0  # Default: no reward

    def _check_terminated(self) -> bool:
        """Check if episode is done. Override in subclass."""
        return False  # Default: never terminates (relies on truncation)

    def _get_observation(self) -> np.ndarray:
        """Capture and resize screenshot."""
        screenshot_bytes = self._page.screenshot(type="jpeg", quality=70)
        img = Image.open(io.BytesIO(screenshot_bytes))
        img = img.resize((self.obs_width, self.obs_height), Image.BILINEAR)
        return np.array(img, dtype=np.uint8)

    def render(self) -> Optional[np.ndarray]:
        if self.render_mode == "rgb_array":
            screenshot = self._page.screenshot(type="png")
            img = Image.open(io.BytesIO(screenshot))
            return np.array(img)
        # "human" mode: browser is already visible if headless=False
        return None

    def close(self):
        if self._page:
            self._page.close()
            self._page = None
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None
