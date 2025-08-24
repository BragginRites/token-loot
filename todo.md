# Token Loot Module Refactoring TODO

## Overview
Refactor `groupManager.js` to improve maintainability by separating concerns, moving HTML to templates, and consolidating CSS.

## Current Issues
- `groupManager.js` is doing too much (~650+ lines)
- HTML templates are inline strings
- CSS is inline in JavaScript
- Mixed responsibilities in single file

## Proposed Structure

### File Organization
```
scripts/
├── ui/
│   ├── groupManager.js              # Main orchestrator (much smaller)
│   ├── components/
│   │   ├── groupCard.js            # Group card rendering & interactions
│   │   ├── distributionBlock.js    # Distribution block management
│   │   ├── actorChips.js          # Actor chip rendering & management
│   │   └── currencyInputs.js      # Currency input handling
│   ├── dialogs/
│   │   ├── confirmDialog.js       # Confirmation dialog utility
│   │   └── batchItemDialog.js     # Batch item addition dialog
│   └── managers/
│       ├── dragDropManager.js     # Drag & drop functionality
│       ├── resizeManager.js       # Panel resizing logic
│       └── stateManager.js        # State management & persistence
├── utils/
│   └── settings.js                # (existing)

templates/
├── groupManager.html              # Main panel template
├── groupCard.html                 # Individual group card template
├── distributionBlock.html         # Distribution block template
├── confirmDialog.html             # Confirmation dialog template
└── batchItemDialog.html          # Batch item dialog template

styles/
└── token-loot.css                 # All CSS consolidated here
```

## Phase 1: Infrastructure Setup
- [ ] Create `templates/` directory
- [ ] Create component directories in `scripts/ui/`
- [ ] Set up template loading utility function
- [ ] Create base CSS structure in `token-loot.css`

## Phase 2: Extract Templates
- [ ] Extract main panel HTML to `templates/groupManager.html`
- [ ] Extract group card HTML to `templates/groupCard.html`
- [ ] Extract distribution block HTML to `templates/distributionBlock.html`
- [ ] Extract confirmation dialog HTML to `templates/confirmDialog.html`
- [ ] Extract batch item dialog HTML to `templates/batchItemDialog.html`
- [ ] Create template rendering utility with variable substitution

## Phase 3: Extract CSS
- [ ] Move all inline CSS from `groupManager.js` to `styles/token-loot.css`
- [ ] Organize CSS by component sections
- [ ] Ensure CSS variables are preserved [[memory:5596931]]
- [ ] Test styling consistency

## Phase 4: Create Component Files

### State Management
- [ ] Create `managers/stateManager.js`
  - [ ] Move state initialization
  - [ ] Move autosave functionality
  - [ ] Move data persistence logic
  - [ ] Export state management functions

### Dialog Components
- [ ] Create `dialogs/confirmDialog.js`
  - [ ] Move `confirmDialog` function with Shift-key skip functionality
  - [ ] Handle template loading and rendering
  - [ ] Export dialog functions

- [ ] Create `dialogs/batchItemDialog.js`
  - [ ] Move batch item addition dialog logic
  - [ ] Handle template loading and rendering
  - [ ] Export dialog functions

### UI Components
- [ ] Create `components/groupCard.js`
  - [ ] Move `renderGroupCard` function
  - [ ] Move group-level event handlers (title editing, deletion)
  - [ ] Handle group card template rendering
  - [ ] Export group card functions

- [ ] Create `components/distributionBlock.js`
  - [ ] Move distribution block rendering logic
  - [ ] Move block-level event handlers
  - [ ] Move item management within blocks
  - [ ] Handle distribution block template rendering
  - [ ] Export distribution block functions

- [ ] Create `components/actorChips.js`
  - [ ] Move actor chip rendering logic
  - [ ] Move actor removal functionality
  - [ ] Handle actor-related drag/drop
  - [ ] Export actor chip functions

- [ ] Create `components/currencyInputs.js`
  - [ ] Move currency input handling
  - [ ] Move currency validation logic
  - [ ] Export currency functions

### Manager Components
- [ ] Create `managers/dragDropManager.js`
  - [ ] Move `enableDroppable` function
  - [ ] Move `parseDrop` function
  - [ ] Move all drag/drop event handling
  - [ ] Export drag/drop functions

- [ ] Create `managers/resizeManager.js`
  - [ ] Move `makeDraggable` function
  - [ ] Move `makeResizable` function
  - [ ] Move `saveSize` and `loadSavedSize` functions
  - [ ] Export resize/drag functions

## Phase 5: Refactor Main File
- [ ] Update `groupManager.js` to import from new modules
- [ ] Remove extracted code from main file
- [ ] Update function calls to use imported modules
- [ ] Ensure all functionality still works
- [ ] Verify template loading works correctly

## Phase 6: Testing & Cleanup
- [ ] Test all delete operations with Shift-key skip
- [ ] Test drag and drop functionality
- [ ] Test group creation and editing
- [ ] Test distribution block management
- [ ] Test actor chip management
- [ ] Test currency input handling
- [ ] Test panel resizing and dragging
- [ ] Verify CSS styling is preserved
- [ ] Remove any unused code
- [ ] Update imports/exports as needed

## Phase 7: Utilities & Polish
- [ ] Create `utils/templateLoader.js` for efficient template caching
- [ ] Add JSDoc comments to all new modules
- [ ] Ensure consistent error handling across modules
- [ ] Optimize template loading performance
- [ ] Add any missing accessibility attributes

## Success Criteria
- [ ] `groupManager.js` reduced to ~50-80 lines (orchestration only)
- [ ] No inline HTML strings in JavaScript
- [ ] No inline CSS in JavaScript
- [ ] All functionality preserved
- [ ] Code is more maintainable and modular
- [ ] Templates follow user preference [[memory:7094209]]
- [ ] CSS variables preserved [[memory:5596931]]

## Notes
- Maintain existing functionality throughout refactor
- Keep user preferences in mind (HTML in templates, separate CSS, separate JS)
- Ensure Shift-key confirmation skip functionality is preserved
- Test thoroughly after each phase
