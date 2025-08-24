# Project Overview

**Working title:** Token Loot

**Target stack:** Foundry VTT v13, dnd5e system v5.1+

**High level goal:**
Attach configurable loot rules to specific actors or actor groups so that, on createToken, the token receives 0 to N items selected at random from designer curated lists. Lists are drawn from selected compendiums. Each item has its own independent chance. Item count per actor group is configurable.

---

## Core Features

1. Actor group buckets

   * GM creates named groups (e.g., “Norse Warriors,” “Wizards,” “Skeletons”).
   * Groups contain one or more Actor UUIDs. **Strict rule: an actor cannot belong to more than one group.** If attempted, show a warning and block.
   * On createToken, if the actor belongs to a group, apply that group’s rules.
2. Loot rules per group

   * Configurable min/max items.
   * Allow duplicates toggle.
   * Independent chance per item.
   * Currency row at the top of each group.
3. List editor per group

   * Drag and drop from compendium browsers into the list.
   * Each row: item name, pack, document id, type, chance (independent %), quantity range, attunement flag, equip behavior.
   * Per row enable/disable.
4. Actor membership UI

   * Drag actors from the Actor tab into a group membership panel.
   * Panel has dashed bordered boxes with placeholders (“+ Add Actor”).
   * Always one empty slot visible for new additions.
5. Rolling engine

   * On createToken, detect if actor is in any group.
   * Roll currency first, then items per independent chance.
   * GM prompt option: suppressible by setting. Options: keep gear, replace, equip over, cancel.
6. Scopes and presets

   * World level preset, Scene override, Folder override, Actor override.
   * Export and import presets as JSON.
7. Logging and preview

   * Dry run button in sheet. Chat card log of what was rolled (items + currency).
   * Log is always GM-only.
   * Chat card includes optional “Remove Granted Loot” button to clean flagged items.
   * Session history persists until refresh or server restart.

---

## UI Sketch

* Main Config Dialog

  * Left: Actor group list.
  * Top: Group settings \[Min items, Max items, Allow duplicates, Currency rules].
  * Center: Item list for selected group. Table with columns \[On, Item, Pack, Type, Qty, Chance, Attune, Equip].
  * Right: Group membership editor (drag/drop actors into dashed slots).
  * Bottom: Global controls \[Scopes preset selector, Import, Export, Reset, Save].
* Quick Test Drawer

  * Fields: Actor selector, roll preview including currency.
  * Header: `Name: ${a.name} | Type: ${a.system.details?.type?.value ?? "-"} | CR: ${a.system.details?.cr ?? "-"}`

---

## Data Model (actor-based)

```ts
interface LBASettings {
  schema: 1;
  scopes: { world: RuleSet; scenes: Record<string, RuleSet>; folders: Record<string, RuleSet>; actors: Record<string, RuleSet>; };
}

interface RuleSet {
  groups: Record<string, ActorGroup>; // keyed by group id
}

interface ActorGroup {
  id: string; // e.g. "norse-warriors"
  name: string;
  actorUUIDs: string[]; // which actors belong, unique across all groups
  minItems: number;
  maxItems: number;
  allowDuplicates: boolean;
  currency?: CurrencyRow;
  loot: LootRow[];
}

interface LootRow {
  uuid: string; // compendium UUID
  chance: number; // independent 0-1
  qtyMin?: number; qtyMax?: number;
  attune?: boolean;
  equip?: boolean;
  enabled: boolean;
}

interface CurrencyRow {
  gp?: string; sp?: string; pp?: string; cp?: string; ep?: string; // dice formula strings, e.g. "2d6*10"
}
```

---

## Hooks and Integration

* Hook: createToken or preCreateToken

  * Resolve actor from tokenDocument.
  * Find the one group containing this actor. If none, skip.
  * Roll currency first, then roll items using independent chances.
  * GM prompt appears if enabled in settings; can be suppressed for automation-heavy workflows.
  * Create embedded Item documents and currency updates on actor.
  * Emit GM-only chat card with log and optional undo.

---

## Rolling Logic

1. Determine N = random integer in \[minItems, maxItems].
2. Roll currency dice formulas, add to actor.
3. For each loot row: roll chance. Collect successes.
4. If successes > N, randomly trim to N.
5. If successes < N, fill from pool with replacement until N.
6. Apply quantities. Create items with flags.
7. If equip/attune is checked, GM prompt decides if auto applied.

---

## Open Questions (actor-based, v2)

1. Group priority: currently strict single group membership is enforced. OK to block duplicate membership with an error notification?
2. Actor membership: should group membership be stored as raw UUIDs only, or allow fallback by actor name if UUID changes? (default UUID only)
3. GM prompt: default action when suppressed — Keep existing, Replace all, or Merge?
4. Undo retention: session-only is planned. Should there be a max history length?
5. Export format: JSON with UUIDs, auto-resolve names when importing for readability.
6. Should we allow notes/descriptions per group for organizational clarity?
7. Any need for conditional loot (e.g. only if actor alignment is X)?

---

## Next Actions

* Implement group membership editor with drag/drop actor assignment and warning on multiple memberships.
* Finalize GM prompt suppression logic and default action.
* Implement dice formula parsing for currency.
* Build minimal rolling pass with GM-only chat logging and session history.
* Provide import/export JSON for groups and loot lists.
