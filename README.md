# Token Loot (MVP)

Grants random loot to tokens on creation based on world-level group rules.

- Foundry VTT v13+
- dnd5e 5.1+

Setup:
1. Enable the module.
2. Open Module Settings -> Token Loot Settings and edit JSON to define groups.

Example settings payload:
```json
{
  "schema": 1,
  "scopes": {
    "world": {
      "groups": {
        "skeletons": {
          "id": "skeletons",
          "name": "Skeletons",
          "actorUUIDs": ["Actor.your-actor-id"],
          "minItems": 1,
          "maxItems": 2,
          "allowDuplicates": false,
          "currency": { "gp": "1d6*2" },
          "loot": [
            { "uuid": "Compendium.dnd5e.items.ItemId", "chance": 0.5, "qtyMin": 1, "qtyMax": 1, "enabled": true }
          ]
        }
      }
    },
    "scenes": {},
    "folders": {},
    "actors": {}
  }
}
```

Notes:
- Only the first group containing the actor is applied.
- Posts a GM-only chat summary.
- Granted items are flagged with `flags.token-loot.granted`.
