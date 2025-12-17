'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Sw5eAdapter extends SystemAdapter {
    /**
     * @override
     */
    shouldEquipItemType(type) {
        const t = String(type || '').toLowerCase();
        return ['weapon', 'armor', 'equipment', 'implant', 'shield'].includes(t);
    }

    /**
     * @override
     */
    equipItem(itemData) {
        if (this.shouldEquipItemType(itemData.type)) {
            if (itemData.system && typeof itemData.system.equipped === 'boolean') {
                itemData.system.equipped = true;
            }
        }
    }

    /**
     * @override
     * SW5e uses 'gc' (galactic credits) as the main currency.
     */
    async addCurrency(actor, currencyPayload) {
        // payload might contain 'gp' if generic loot generator was used
        // map 'gp' or 'credits' to 'gc'
        const updates = { system: { currency: foundry.utils.deepClone(actor.system.currency ?? {}) } };
        let hasUpdates = false;

        for (let [key, value] of Object.entries(currencyPayload)) {
            // Map generic keys to SW5e 'gc' if applicable
            // If the user defines "100gc" in the loot, key will be "gc".
            // If they define "100gp" (generic), we might want to map it, or just let it fail/ignore.
            // Assumption: User uses correct currency keys for the system.
            // But 'credits' is a common alias.
            if (key === 'credits' || key === 'credit') key = 'gc';

            if (updates.system.currency[key] !== undefined) {
                updates.system.currency[key] = (updates.system.currency[key] ?? 0) + (value ?? 0);
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            await actor.update(updates);
        }
    }
}
