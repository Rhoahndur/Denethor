"""
PufferLib wrapper for browser game environments.
"""

import pufferlib
import pufferlib.emulation

from ..envs.game_env import BrowserGameEnv


def make_env(
    game_url: str,
    game_category: str = "arcade",
    use_universal_actions: bool = False,
    headless: bool = True,
    **kwargs,
):
    """
    Environment factory for PufferLib vectorization.

    Returns a function that creates PufferLib-wrapped environments.
    """

    def _make():
        env = BrowserGameEnv(
            game_url=game_url,
            game_category=game_category,
            use_universal_actions=use_universal_actions,
            headless=headless,
            **kwargs,
        )
        return pufferlib.emulation.GymnasiumPufferEnv(env=env)

    return _make
