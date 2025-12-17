"""
PufferLib wrapper for browser game environments.
"""

import pufferlib
import pufferlib.emulation

from ..envs.game_env import BrowserGameEnv


class EnvCreator:
    """
    Picklable environment creator for PufferLib multiprocessing.

    This class wraps environment creation parameters so they can be
    pickled and sent to worker processes.
    """

    def __init__(
        self,
        game_url: str,
        game_category: str = "arcade",
        use_universal_actions: bool = False,
        headless: bool = True,
        **kwargs,
    ):
        self.game_url = game_url
        self.game_category = game_category
        self.use_universal_actions = use_universal_actions
        self.headless = headless
        self.kwargs = kwargs

    def __call__(self, buf=None, seed=None):
        """Create and return a PufferLib-wrapped environment.

        Args:
            buf: Buffer passed by PufferLib vectorization (ignored for Gymnasium envs)
            seed: Random seed passed by PufferLib (used for environment reset)
        """
        env = BrowserGameEnv(
            game_url=self.game_url,
            game_category=self.game_category,
            use_universal_actions=self.use_universal_actions,
            headless=self.headless,
            **self.kwargs,
        )
        wrapped = pufferlib.emulation.GymnasiumPufferEnv(env=env, buf=buf)
        if seed is not None:
            wrapped.reset(seed=seed)
        return wrapped


def make_env(
    game_url: str,
    game_category: str = "arcade",
    use_universal_actions: bool = False,
    headless: bool = True,
    **kwargs,
):
    """
    Environment factory for PufferLib vectorization.

    Returns a picklable callable that creates PufferLib-wrapped environments.
    """
    return EnvCreator(
        game_url=game_url,
        game_category=game_category,
        use_universal_actions=use_universal_actions,
        headless=headless,
        **kwargs,
    )
