"""
Base browser environment for PufferLib training.
Handles Playwright browser lifecycle and screenshot capture.

Uses Playwright's async API internally to be compatible with PufferLib's
asyncio-based vectorization.
"""

import asyncio
import io
from typing import Optional

import gymnasium as gym
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright, Browser, Page


def _get_or_create_event_loop():
    """Get the current event loop or create a new one if needed."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


def _run_async(coro):
    """Run an async coroutine from sync code, handling existing event loops."""
    try:
        loop = asyncio.get_running_loop()
        # We're inside an async context, create a task
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(coro)
    except RuntimeError:
        # No running loop, create one
        loop = _get_or_create_event_loop()
        return loop.run_until_complete(coro)


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

    async def _ensure_browser_async(self):
        """Lazy browser initialization (async)."""
        if self._page is not None:
            return

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-extensions",
            ],
        )
        self._page = await self._browser.new_page(
            viewport={"width": self.viewport_width, "height": self.viewport_height}
        )

    def _ensure_browser(self):
        """Lazy browser initialization (sync wrapper)."""
        if self._page is not None:
            return
        _run_async(self._ensure_browser_async())

    async def _reset_async(
        self, seed: Optional[int] = None, options: Optional[dict] = None
    ) -> tuple[np.ndarray, dict]:
        """Reset environment (async implementation)."""
        await self._ensure_browser_async()

        # Navigate to game
        await self._page.goto(self.game_url, wait_until="domcontentloaded")
        self._steps = 0

        # Wait for initial load
        await self._page.wait_for_timeout(2000)

        obs = await self._get_observation_async()
        info = {"steps": 0, "url": self.game_url}

        return obs, info

    def reset(
        self, seed: Optional[int] = None, options: Optional[dict] = None
    ) -> tuple[np.ndarray, dict]:
        super().reset(seed=seed)
        return _run_async(self._reset_async(seed=seed, options=options))

    async def _step_async(self, action: int) -> tuple[np.ndarray, float, bool, bool, dict]:
        """Step environment (async implementation)."""
        self._steps += 1

        # Execute action (subclass implements this)
        await self._execute_action_async(action)

        # Small delay for game to respond
        await self._page.wait_for_timeout(50)

        # Get observation
        obs = await self._get_observation_async()

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

    def step(self, action: int) -> tuple[np.ndarray, float, bool, bool, dict]:
        return _run_async(self._step_async(action))

    async def _execute_action_async(self, action: int):
        """Execute action (async). Override in subclass."""
        raise NotImplementedError("Subclass must implement _execute_action_async")

    def _compute_reward(self, obs: np.ndarray) -> float:
        """Compute reward. Override in subclass for game-specific rewards."""
        return 0.0  # Default: no reward

    def _check_terminated(self) -> bool:
        """Check if episode is done. Override in subclass."""
        return False  # Default: never terminates (relies on truncation)

    async def _get_observation_async(self) -> np.ndarray:
        """Capture and resize screenshot (async)."""
        screenshot_bytes = await self._page.screenshot(type="jpeg", quality=70)
        img = Image.open(io.BytesIO(screenshot_bytes))
        img = img.resize((self.obs_width, self.obs_height), Image.BILINEAR)
        return np.array(img, dtype=np.uint8)

    def render(self) -> Optional[np.ndarray]:
        if self.render_mode == "rgb_array":

            async def _render():
                screenshot = await self._page.screenshot(type="png")
                img = Image.open(io.BytesIO(screenshot))
                return np.array(img)

            return _run_async(_render())
        # "human" mode: browser is already visible if headless=False
        return None

    async def _close_async(self):
        """Close browser resources (async)."""
        if self._page:
            await self._page.close()
            self._page = None
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    def close(self):
        _run_async(self._close_async())
