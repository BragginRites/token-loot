'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Pf1eAdapter extends SystemAdapter {
    equipItem(itemData) {
        // PF1e is very similar to D&D 3.5e/5e structure for equipped
        if (typeof itemData.system?.equipped === 'boolean') {
            itemData.system.equipped = true;
        }
    }
    /**
     * @override
     */
    async addCurrency(actor, currencyPayload) {
        // PF1e uses strict currency keys
        const validKeys = ['pp', 'gp', 'sp', 'cp'];
        const updates = { system: { currency: foundry.utils.deepClone(actor.system.currency ?? {}) } };
        let hasUpdates = false;

        for (const [key, value] of Object.entries(currencyPayload)) {
            if (validKeys.includes(key) && updates.system.currency[key] !== undefined) {
                updates.system.currency[key] = (updates.system.currency[key] ?? 0) + (value ?? 0);
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            await actor.update(updates);
        }
    }
}
