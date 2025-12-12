"""Game type registry and configurations."""

from .registry import (
    GameCategory,
    GameConfig,
    get_game_config,
    get_universal_config,
    list_game_categories,
    register_game_category,
)

__all__ = [
    "GameCategory",
    "GameConfig",
    "get_game_config",
    "get_universal_config",
    "list_game_categories",
    "register_game_category",
]
