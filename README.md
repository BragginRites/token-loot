# Token Loot

A loot distribution system for Foundry VTT that automatically grants randomized loot to tokens when they're created on the canvas.

## Features

- **Automatic loot on token creation**
- **Per-item quantity ranges** with min/max values
- **Independent chance rolls per item** (new default)
- **Optional bounded chance mode** via "Force Qty" with Min/Max rolls
- **Duplicate control** per block (allow or prevent duplicates)
- **Drag-and-drop group manager** for actors and items
- **Batch import items** from folders
- **Resizable/draggable** manager window with auto-save
- **GM-only chat summaries** of granted loot

## Distribution Modes

Each group contains one or more distribution blocks. A block can be configured in one of three modes:

1. **All**: Grant every item in the block once.
2. **Pick N**: Randomly select N items from the block. The "Allow duplicates" toggle lets the same item be picked multiple times.
3. **Chances**:
   - By default, the module rolls each item's chance once and grants any items that succeed.
   - Enable **Force Qty** to roll a random target between "Min Rolls" and "Max Rolls" and run independent chances until the target is met. "Allow duplicates" controls whether the same item can be granted more than once in this bounded mode.

### Quantities per Item

Each item row has `Qty Min` and `Qty Max`. When an item is granted, a random integer between these values is used as the quantity.

## Group Manager Overview

- Create a group and drag actors from the sidebar into it.
- Add distribution blocks and drag items (or item folders) into each block.
- Configure per-item chance and quantity, per-block mode, duplicates, and the optional Force Qty bounds.
- Shift+Click delete buttons to skip confirmation dialogs.

## Requirements and Compatibility

- **Foundry VTT v13+**
- Works with any game system. There is no dnd5e requirement.
- System-specific enhancements (e.g., automatic spell scroll creation, certain auto-equip behaviors) are applied when supported by the system, but are not required.

### Currency

Currency distribution is currently not supported across systems. The UI may expose currency fields; treat them as experimental for now.

## Setup

1. Enable the module in your world.
2. Open the Loot Group Manager via Module Settings → Token Loot.
3. Click "Add Loot Group" to create a group.
4. Drag actors into the group, then drag items into distribution blocks.
5. Configure chances, quantities, and modes as desired.

## Settings

- **Apply Loot in preCreate for Unlinked Tokens**: When enabled, unlinked tokens receive loot during preCreate, which reduces race conditions. In this mode, only the first matching group is applied.
- **Loot Award Stagger (ms)** and **Per-Item Award Stagger (ms)**: Optional delays to reduce contention during item creation.

## Notes

- On token creation, all matching groups are applied. In preCreate mode (unlinked tokens option), only the first matching group is applied.
- A GM-only chat summary is posted after loot is granted (when possible).
- Granted items are flagged with `flags.token-loot.granted`.
