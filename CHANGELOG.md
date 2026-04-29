## [1.2.0] - 2026-04-28
### Smart Filters — system-aware panel
- Filter fields are defined per supported game system, so labels and data paths match what that system actually stores (creature type, size, CR or level, AC, HP, abilities, alignment, spellcasting, and so on).
- Unmapped or generic setups still get a safe, minimal filter set so the module remains usable.
- On each group card, Smart Filters are edited in one place: **Identity & traits** (name, actor type, and related text fields), chip rows for **alignment** and **size**, toggles such as **spellcasting**, **Combat & level** ranges for stats like CR, HP, and AC, and a two-row **Abilities** grid for STR through CHA.
- **Advanced** expands to **custom path** rules: add several paths, each with its own text match; different paths combine with **AND**, so you can require multiple fields at once.
- **Numeric ranges** use two boxes per stat: **left is the inclusive minimum**, **right is the inclusive maximum**. Leave either box blank to skip that bound—so you can require “at least this CR” or “at most this Constitution” without filling both. Bounds on different stats still all apply together (**AND**). Hints on the row describe the behaviour.

### Group setup
- **Test with Actor** lets you pick an actor (or data object) and see whether the current group matches, with clear reasons, before you rely on it at the table.

### Matching feedback
- Explanations spell out why a group matched or failed against an actor.
- The manager’s group order is the order matching uses, so priority stays visible and predictable.

### Reliability and diagnostics
- Missing item links and item creation failures are handled with clearer reporting.

### Documentation
- README includes a quick start, system support overview, and common pitfalls.
- Behaviour notes clarify linked vs unlinked token outcomes.

## [1.1.0] - 2026-04-27
### Smart Grouping & Matching
- Introduced two group types: **Individual Actors** and **Smart Filters**.
- Smart Filters can match actors dynamically by details like name, creature type, size, CR, and more.
- Group matching now applies all relevant groups for an actor, so overlapping rules can both grant loot.

### Group Manager Improvements
- Added quick sidebar actions for duplicate/delete and support for drag-and-drop group reordering.
- Added a persistent **Linked NPC Override** toggle in the sidebar footer.
- Added double-click group editing and improved mode selection dialog behavior/layout.

### Item List UX
- Clicking an item icon or name now opens that item sheet for quick viewing.
- Added clearer hover/click affordances and sidebar readability/layout polish.

## [1.0.0] - 2026-04-26
### Master/Detail UI Redesign
- **New Layout:** Migrated the Group Manager to a two-pane **Master/Detail** layout.
  - Left sidebar for group navigation and search.
  - Right detail panel for focused editing of group configurations.
- **Group Customization:** Added new group metadata options via right-click context menu:
  - **Custom Icons:** Choose from a curated grid of FontAwesome icons (skull, dragon, treasure, etc.) or provide a custom icon class with text field.
  - **Custom Colors:** Assign colors to groups to help with visual categorization.

## [0.0.2] - 2025-12-17
### Architecture Refactor & V13 Support
- **System Agnostic Core:** Refactored the entire codebase to use a `SystemAdapter` pattern.
- **New System Support:** Added native support for:
  - Pathfinder 2e (`pf2e`) - Correctly handles 'worn' vs 'held' items.
  - Pathfinder 1e (`pf1`)
  - Starfinder 1e (`sfrpg`)
  - Star Wars 5e (`sw5e`) - Native support for Galactic Credits and equipment.
  - D&D 5e (`dnd5e`) - Modern V13 API usage for scroll creation.
- **Foundry V13 Compatibility:**
  - Migrated Settings Menu to `foundry.applications.api.ApplicationV2`.
  - Enforced `preCreateToken` logic for all unlinked tokens (removing the optional setting) to prevent race conditions by default.
- **Performance:**
  - Implemented incremental DOM updates for the Group Manager (no more full re-renders on every action).
  - Added Search filtering and "Collapse All" for better group management.
- **UX Improvements:**
  - Added hint text to empty drop zones.
  - Improved folder drag-and-drop validation.
- **Bug Fixes:**
  - Resolved circular dependency issues.
  - Fixed missing `mergeCurrency` logic.
  - Enforced strict currency key validation for PF2e (`pp, gp...`) and SF1e.
