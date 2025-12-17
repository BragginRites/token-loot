# Changelog

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
