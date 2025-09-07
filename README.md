# Token Loot

A loot distribution system for Foundry VTT that automatically grants randomized loot to tokens when they're created on the canvas.

<img width="1176" height="1282" alt="image" src="https://github.com/user-attachments/assets/c61a692f-f0ab-4d1f-b3cd-f33e8fb98853" />

Coffee helps me stay up to 2am to write these modules. Thank you for the lack of sleep in advance!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/bragginrites)

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

## How to use it

1. Enable the module in your world.
2. Open the Loot Group Manager via the actor tab button at the bottom of the sidebar or Module Settings → Token Loot.
3. Click "Add Loot Group" to create a group.
4. Drag actors into the group, then drag items into distribution blocks.
5. Configure chances, quantities, and modes as desired.
6. Place a token that belongs to the group onto the canvas to grant loot.

## Distribution Modes

Each group contains one or more distribution blocks. A block can be configured in one of three modes:

1. **All**: Grant every item in the block once.
2. **Pick N**: Randomly select N items from the block. The "Allow duplicates" toggle lets the same item be picked multiple times.
3. **Chances**:
   - By default, the module rolls each item's chance once and grants any items that succeed.
   - Enable **Force Qty** to roll a random target between "Min Rolls" and "Max Rolls" and run independent chances until the target is met. "Allow duplicates" controls whether the same item can be granted more than once in this bounded mode.

### How it works

- **All**
  - The token gets every item in the block once.
  - Each granted item rolls a quantity independently between `Qty Min` and `Qty Max`.

- **Pick N**
  - The module randomly picks N number of items from the block.
  - If "Allow duplicates" is OFF, it won’t pick the same item twice. If there aren’t enough different items, you get what’s available.
  - If "Allow duplicates" is ON, the same item can be picked more than once.
  - Each picked item rolls a quantity independently between `Qty Min` and `Qty Max`.

- **Chances (default)**
  - For each item, we roll its chance once. If it succeeds, you get that item (at most one copy).
  - Each granted item rolls a quantity independently between `Qty Min` and `Qty Max`.

- **Chances with Force Qty**
  - First, we decide how many items to try for using the "Min Rolls"/"Max Rolls" range.
  - Then we roll item chances until that many items succeed.
  - If "Allow duplicates" is OFF, the same item won’t appear twice; you might end up with fewer than the target if you do not have a large enough pool of items and not enough items succeed.
  - If "Allow duplicates" is ON, the same item can appear more than once and will continue to roll chances until the target is met.
  - Each granted item rolls a quantity independently between `Qty Min` and `Qty Max`.

## Requirements and Compatibility

- **Foundry VTT v13+**
- Works with any game system. There is no dnd5e requirement.
- System-specific enhancements (e.g., automatic spell scroll creation, certain auto-equip behaviors) are applied when supported by the system, but are not required.

### Currency

Currency distribution is currently not supported across systems other than dnd5e. The UI may expose currency fields; treat them as experimental for now.

## Settings

- **Apply Loot in preCreate for Unlinked Tokens**: When enabled, unlinked tokens receive loot during preCreate, which reduces race conditions.
- **Loot Award Stagger (ms)** and **Per-Item Award Stagger (ms)**: Optional delays to reduce contention during item creation.

## Notes

- On token creation, all matching groups are applied. In preCreate mode (unlinked tokens option), only the first matching group is applied.
- A GM-only chat summary is posted after loot is granted (when possible).
- Granted items are flagged with `flags.token-loot.granted` so we can identify them in the future for deletion or other purposes.
