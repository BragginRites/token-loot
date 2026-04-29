# Token Loot

A loot distribution system for Foundry VTT that automatically grants randomized loot to tokens when they're created on the canvas.

[![Foundry Version](https://img.shields.io/badge/Foundry-v13-orange)](https://foundryvtt.com/)
[![Patreon](https://img.shields.io/badge/Patreon-Support-red?logo=patreon)](https://www.patreon.com/BragginRites)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20Coffee-blue?logo=ko-fi)](https://ko-fi.com/bragginrites)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?logo=discord)](https://discord.gg/bnVCtQuyMr)

<img width="1248" height="1159" alt="image" src="https://github.com/user-attachments/assets/20eface4-952c-4121-9a71-9f8800249fa8" />

## Support Development & Vote on Features

Maintaining these modules takes time and caffeine. If you enjoy using Token Loot, there are two ways to support the project:

### 1. Join the Dev Circle (Patreon)

Join me on [Patreon](https://www.patreon.com/BragginRites) to support maintenance of my Foundry modules and my project TTRPG, **Chantry**.
- **Vote:** Help decide which modules and features get prioritised next.
- **Preview:** See early builds of modules and Chantry.
- **Access:** Get supporting roles in Discord.

### 2. The Tip Jar (Ko-fi)

Not into subscriptions? You can toss a coin in the jar on [Ko-fi](https://ko-fi.com/bragginrites). It keeps the coffee flowing during those 2 AM coding sessions.

## Other Modules

Check out my other module(s):
- [BG3 Inspired HUD - Core](https://github.com/BragginRites/bg3-hud-core)
- [BG3 Inspired HUD - D&D5e](https://github.com/BragginRites/bg3-hud-dnd5e)
- [BG3 Inspired HUD - PF2e](https://github.com/BragginRites/bg3-hud-pf2e)
- [BG3 Inspired HUD - DC20 RPG](https://github.com/BragginRites/bg3-hud-dc20rpg)
- [Surge Dice - A Narrative Dice Pool](https://github.com/BragginRites/surge-dice)
- [Inspect Statblock](https://github.com/BragginRites/inspect-statblock)

## Features

- **Automatic loot on token creation**
- **Per-item quantity ranges** with min/max values
- **Independent chance rolls per item** (new default)
- **Optional bounded chance mode** via "Number of Items" with Min/Max rolls
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

## 5-minute setup

1. Create an **Individual Actors** group for one known NPC.
2. Drag that NPC into the actors section.
3. Add one distribution block and drop a few items into it.
4. Leave the block on **Chances** and set a simple `100` chance for one item.
5. Place an unlinked token for that NPC on a scene and check the actor inventory.

Once that works, add Smart Filters or extra distribution blocks. Smart Filters use the active system adapter, so the available fields change by game system.

### Group ordering (priority)

- In the Group Manager sidebar, drag and drop groups to reorder them.
- Group order is top-to-bottom and persistent across sessions/server restarts.
- When multiple groups match, they are applied in visible order.
- This is a linear order (not nested folders/sub-groups).
- Use **Test with Actor** in the manager to preview which groups match and why before placing tokens.

## Distribution Modes

Each group contains one or more distribution blocks. A block can be configured in one of three modes:

1. **All**: Grant every item in the block once.
2. **Pick N**: Randomly select N items from the block. The "Allow duplicates" toggle lets the same item be picked multiple times.
3. **Chances** (default):
   - By default, the module rolls each item's chance once and grants any items that succeed.
   - Enable **Number of Items** to roll a random target between "Min Rolls" and "Max Rolls" and run independent chances until the target is met. "Allow duplicates" controls whether the same item can be granted more than once in this bounded mode.

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

- **Chances with Number of Items**
  - First, we decide how many items to try for using the "Min Rolls"/"Max Rolls" range.
  - Then we roll item chances until that many items succeed.
  - If "Allow duplicates" is OFF, the same item won’t appear twice; you might end up with fewer than the target if you do not have a large enough pool of items and not enough items succeed.
  - If "Allow duplicates" is ON, the same item can appear more than once and will continue to roll chances until the target is met.
  - Each granted item rolls a quantity independently between `Qty Min` and `Qty Max`.

## Requirements and Compatibility

- **Foundry VTT v13+**
- Works with any game system. There is no dnd5e requirement.
- System-specific enhancements (e.g., automatic spell scroll creation, certain auto-equip behaviors) are applied when supported by the system, but are not required.

### System support

| System | Currency | Auto-equip | Smart Filters |
| --- | --- | --- | --- |
| D&D 5e (`dnd5e`) | Standard coins | Supported for common equipment types | CR, type, size, alignment, ability scores, HP, AC, spellcasting |
| Star Wars 5e (`sw5e`) | Galactic credits | Supported for common equipment types | CR/level, type, size, alignment, ability scores, HP, AC, Force/tech casting |
| Pathfinder 2e (`pf2e`) | Coins via PF2e inventory when available | Worn/held carry type support | Level, creature type, size, HP, AC, spellcasting |
| Pathfinder 1e (`pf1`) | Standard PF1e coins | Basic equipped flag support | CR, type, size, alignment, ability scores, HP, AC |
| Starfinder 1e (`sfrpg`) | Credits and UPBs | Basic equipped flag support | CR, type, size, ability scores, HP, EAC, KAC |
| Other systems | Generic currency object fallback | Generic equipped flag fallback | Name, actor type, and custom path |

### Smart Filters (chips and ranges)

- **Smart Filter** groups use **multi-select** controls where the system exposes enums, **min–max ranges** for numeric fields (leave both min and max empty to skip that stat), **Any / Yes / No** for boolean traits, and **text** fields where configured. **Identity** is ordered: name (contains), creature type, spellcasting (when available), alignment, then size. Ability scores sit in two rows (STR–CON, then INT–CHA).
- **Advanced** is a collapsible section for **custom paths**: add multiple path + “contains” rows; **remove** clears a row (or the fields when only one row remains). **Different paths** are combined with **AND**; multiple rules on the **same** path still use **OR**.
- **Same field** (except distinct custom paths) → rules are **OR**. **Different fields** → **AND**.
- Saves from older builds may include **legacy** operators the panel cannot represent. Those rows **still evaluate**; the manager shows a short warning. **Clear panel filters** removes only what the panel controls, not legacy rows.

### Currency

Currency distribution is adapter-driven. If your system is not listed above, Token Loot only updates currency keys that already exist on `actor.system.currency`.

## Settings

- **Loot Award Stagger (ms)** and **Per-Item Award Stagger (ms)**: Optional delays to reduce contention during item creation.
- **GM Chat Summary**: Post a GM-only chat summary after loot is granted.
- **Linked NPC Override**: Allow linked NPC tokens to receive loot on creation from the manager footer.

## Common pitfalls

- **Linked NPCs do not receive loot by default.** Enable Linked NPC Override if you intentionally want linked NPC tokens to be modified on creation.
- **Unlinked tokens receive loot during `preCreateToken`.** This reduces race conditions, but it also means only data-safe adapter operations run at that stage.
- **Smart Filter fields are system-specific.** Use Custom Path when your system stores a value outside the listed fields.
- **Multiple matching groups can apply.** Group order is still useful for organisation and review, but overlapping rules may all grant loot.
- **Need to debug matching?** The manager's Test with Actor action explains the current group result. Macro authors can also inspect `game.tokenLoot.api.explainMatches(actor)`.

## Notes

- On token creation, matching groups are applied to the token actor where possible.
- A GM-only chat summary is posted after loot is granted (when possible).
- Granted items are flagged with `flags.token-loot.granted` so we can identify them in the future for deletion or other purposes.
