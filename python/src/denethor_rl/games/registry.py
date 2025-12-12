"""
Game type registry for action spaces and control schemes.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import gymnasium as gym


class GameCategory(Enum):
    """
    High-level game categories.

    This enum defines the built-in categories. To add new categories at runtime,
    use register_game_category() instead of modifying this enum.
    """

    PLATFORMER = "platformer"  # Mario-style: arrows/WASD + jump
    PUZZLE = "puzzle"  # Tetris-style: arrows + rotate
    POINT_AND_CLICK = "point_and_click"  # Adventure: mouse clicks
    SHOOTER = "shooter"  # WASD + mouse aim + click
    ARCADE = "arcade"  # Simple: arrows or WASD
    CARD = "card"  # Click-based card games
    RACING = "racing"  # Arrows or WASD
    RHYTHM = "rhythm"  # Rhythm games: specific key lanes
    STRATEGY = "strategy"  # Turn-based: mouse + hotkeys
    SPORTS = "sports"  # Sports games: varies by sport


@dataclass
class GameConfig:
    """Configuration for a specific game type."""

    category: GameCategory
    action_space: gym.spaces.Space
    action_map: dict[int, tuple[str, str | int | tuple]]  # action_id -> (type, value)
    description: str = ""
    control_hints: list[str] = field(default_factory=list)


# Standard action maps
KEYBOARD_ARROWS = {
    0: ("keyboard", "ArrowUp"),
    1: ("keyboard", "ArrowDown"),
    2: ("keyboard", "ArrowLeft"),
    3: ("keyboard", "ArrowRight"),
    4: ("keyboard", "Space"),
    5: ("keyboard", "Enter"),
    6: ("wait", 100),
}

KEYBOARD_WASD = {
    0: ("keyboard", "w"),
    1: ("keyboard", "s"),
    2: ("keyboard", "a"),
    3: ("keyboard", "d"),
    4: ("keyboard", "Space"),
    5: ("keyboard", "Enter"),
    6: ("wait", 100),
}

KEYBOARD_FULL = {
    **{i: v for i, v in enumerate(KEYBOARD_ARROWS.values())},
    7: ("keyboard", "w"),
    8: ("keyboard", "s"),
    9: ("keyboard", "a"),
    10: ("keyboard", "d"),
    11: ("keyboard", "Escape"),
    12: ("wait", 100),
}


# Mouse grid: 5x5 grid of click positions
def _mouse_grid(start_idx: int, grid_size: int = 5) -> dict:
    """Generate mouse click actions on a grid."""
    actions = {}
    for i in range(grid_size):
        for j in range(grid_size):
            # Normalized coordinates (0-1)
            x = (j + 0.5) / grid_size
            y = (i + 0.5) / grid_size
            actions[start_idx + i * grid_size + j] = ("click", (x, y))
    return actions


MOUSE_GRID_5X5 = _mouse_grid(0, 5)  # 25 click positions


# Pre-defined game configurations
GAME_CONFIGS: dict[GameCategory, GameConfig] = {
    GameCategory.PLATFORMER: GameConfig(
        category=GameCategory.PLATFORMER,
        action_space=gym.spaces.Discrete(7),
        action_map=KEYBOARD_ARROWS,
        description="Side-scrolling platformer (arrows + space to jump)",
        control_hints=["Arrow keys to move", "Space to jump"],
    ),
    GameCategory.PUZZLE: GameConfig(
        category=GameCategory.PUZZLE,
        action_space=gym.spaces.Discrete(7),
        action_map={
            0: ("keyboard", "ArrowUp"),
            1: ("keyboard", "ArrowDown"),
            2: ("keyboard", "ArrowLeft"),
            3: ("keyboard", "ArrowRight"),
            4: ("keyboard", "z"),  # Rotate left
            5: ("keyboard", "x"),  # Rotate right
            6: ("keyboard", "Space"),  # Drop/confirm
        },
        description="Puzzle game (arrows + z/x to rotate)",
        control_hints=["Arrow keys to move", "Z/X to rotate", "Space to drop"],
    ),
    GameCategory.POINT_AND_CLICK: GameConfig(
        category=GameCategory.POINT_AND_CLICK,
        action_space=gym.spaces.Discrete(25),
        action_map=MOUSE_GRID_5X5,
        description="Point-and-click game (mouse only)",
        control_hints=["Click to interact"],
    ),
    GameCategory.SHOOTER: GameConfig(
        category=GameCategory.SHOOTER,
        action_space=gym.spaces.Discrete(32),
        action_map={
            **KEYBOARD_WASD,
            7: ("keyboard", "r"),  # Reload
            **{8 + k: v for k, v in _mouse_grid(0, 5).items()},  # 25 click positions
        },
        description="Shooter (WASD + mouse)",
        control_hints=["WASD to move", "Mouse to aim/shoot", "R to reload"],
    ),
    GameCategory.ARCADE: GameConfig(
        category=GameCategory.ARCADE,
        action_space=gym.spaces.Discrete(7),
        action_map=KEYBOARD_ARROWS,
        description="Classic arcade (arrows + space)",
        control_hints=["Arrow keys to move", "Space to action"],
    ),
    GameCategory.CARD: GameConfig(
        category=GameCategory.CARD,
        action_space=gym.spaces.Discrete(26),
        action_map={
            **MOUSE_GRID_5X5,
            25: ("wait", 500),  # Wait for animations
        },
        description="Card game (mouse clicks)",
        control_hints=["Click to select/play cards"],
    ),
    GameCategory.RACING: GameConfig(
        category=GameCategory.RACING,
        action_space=gym.spaces.Discrete(5),
        action_map={
            0: ("keyboard", "ArrowUp"),  # Accelerate
            1: ("keyboard", "ArrowDown"),  # Brake
            2: ("keyboard", "ArrowLeft"),  # Steer left
            3: ("keyboard", "ArrowRight"),  # Steer right
            4: ("wait", 50),  # Coast
        },
        description="Racing game (arrows)",
        control_hints=["Up to accelerate", "Down to brake", "Left/Right to steer"],
    ),
    GameCategory.RHYTHM: GameConfig(
        category=GameCategory.RHYTHM,
        action_space=gym.spaces.Discrete(6),
        action_map={
            0: ("keyboard", "d"),  # Lane 1
            1: ("keyboard", "f"),  # Lane 2
            2: ("keyboard", "j"),  # Lane 3
            3: ("keyboard", "k"),  # Lane 4
            4: ("keyboard", "Space"),  # Special/activate
            5: ("wait", 50),  # Wait (timing matters)
        },
        description="Rhythm game (4-lane DFJK)",
        control_hints=["D F J K for lanes", "Space for special"],
    ),
    GameCategory.STRATEGY: GameConfig(
        category=GameCategory.STRATEGY,
        action_space=gym.spaces.Discrete(35),
        action_map={
            **MOUSE_GRID_5X5,  # 0-24: Click positions
            25: ("keyboard", "1"),  # Hotkey 1
            26: ("keyboard", "2"),  # Hotkey 2
            27: ("keyboard", "3"),  # Hotkey 3
            28: ("keyboard", "4"),  # Hotkey 4
            29: ("keyboard", "q"),  # Ability Q
            30: ("keyboard", "w"),  # Ability W
            31: ("keyboard", "e"),  # Ability E
            32: ("keyboard", "r"),  # Ability R
            33: ("keyboard", "Space"),  # Confirm/end turn
            34: ("wait", 200),  # Wait (turn-based)
        },
        description="Strategy/turn-based (mouse + hotkeys)",
        control_hints=["Click to select/move", "1-4 for units", "QWER for abilities"],
    ),
    GameCategory.SPORTS: GameConfig(
        category=GameCategory.SPORTS,
        action_space=gym.spaces.Discrete(10),
        action_map={
            0: ("keyboard", "ArrowUp"),
            1: ("keyboard", "ArrowDown"),
            2: ("keyboard", "ArrowLeft"),
            3: ("keyboard", "ArrowRight"),
            4: ("keyboard", "Space"),  # Jump/shoot/action
            5: ("keyboard", "z"),  # Pass/secondary
            6: ("keyboard", "x"),  # Special/boost
            7: ("keyboard", "c"),  # Tackle/block
            8: ("keyboard", "Enter"),  # Pause/menu
            9: ("wait", 50),
        },
        description="Sports game (arrows + action buttons)",
        control_hints=["Arrows to move", "Space to shoot", "Z to pass", "X for special"],
    ),
}


# Universal action space (experimental)
UNIVERSAL_ACTION_MAP = {
    # Keyboard: 0-12
    **KEYBOARD_FULL,
    # Mouse grid 5x5: 13-37
    **{13 + k: v for k, v in MOUSE_GRID_5X5.items()},
    # Additional keys: 38+
    38: ("keyboard", "Tab"),
    39: ("keyboard", "Shift"),
    40: ("keyboard", "Control"),
    41: ("keyboard", "1"),
    42: ("keyboard", "2"),
    43: ("keyboard", "3"),
    44: ("keyboard", "4"),
    45: ("wait", 200),
}

UNIVERSAL_CONFIG = GameConfig(
    category=GameCategory.ARCADE,  # Fallback category for universal
    action_space=gym.spaces.Discrete(46),
    action_map=UNIVERSAL_ACTION_MAP,
    description="Universal action space (all actions, let RL figure it out)",
    control_hints=["All keyboard and mouse actions available"],
)


# Runtime registry for custom categories (extends GAME_CONFIGS)
_CUSTOM_GAME_CONFIGS: dict[str, GameConfig] = {}


def register_game_category(
    name: str,
    action_map: dict[int, tuple],
    description: str = "",
    control_hints: Optional[list[str]] = None,
) -> None:
    """
    Register a new game category at runtime.

    Example:
        register_game_category(
            name="rhythm",
            action_map={
                0: ("keyboard", "d"),
                1: ("keyboard", "f"),
                2: ("keyboard", "j"),
                3: ("keyboard", "k"),
                4: ("keyboard", "Space"),
            },
            description="4-lane rhythm game",
            control_hints=["D F J K for lanes", "Space for special"],
        )
    """
    config = GameConfig(
        category=GameCategory.ARCADE,  # Base category for custom
        action_space=gym.spaces.Discrete(len(action_map)),
        action_map=action_map,
        description=description,
        control_hints=control_hints or [],
    )
    _CUSTOM_GAME_CONFIGS[name] = config


def get_game_config(category: GameCategory | str) -> GameConfig:
    """Get game configuration by category (built-in or custom)."""
    # Check custom registry first
    if isinstance(category, str):
        if category in _CUSTOM_GAME_CONFIGS:
            return _CUSTOM_GAME_CONFIGS[category]
        try:
            category = GameCategory(category)
        except ValueError:
            raise ValueError(
                f"Unknown game category: {category}. " f"Available: {list_game_categories()}"
            )
    return GAME_CONFIGS.get(category, GAME_CONFIGS[GameCategory.ARCADE])


def get_universal_config() -> GameConfig:
    """Get universal (experimental) action space config."""
    return UNIVERSAL_CONFIG


def list_game_categories() -> list[str]:
    """List all available game categories (built-in + custom)."""
    built_in = [c.value for c in GameCategory]
    custom = list(_CUSTOM_GAME_CONFIGS.keys())
    return built_in + custom
