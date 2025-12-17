'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Sf1eAdapter extends SystemAdapter {
    equipItem(itemData) {
        // Starfinder 1e
        if (typeof itemData.system?.equipped === 'boolean') {
            itemData.system.equipped = true;
        }
    }
    /**
     * @override
     */
    async addCurrency(actor, currencyPayload) {
        // Starfinder usage: credit, upb
        const validKeys = ['credit', 'upb'];
        const updates = { system: { currency: foundry.utils.deepClone(actor.system.currency ?? {}) } };
        let hasUpdates = false;

        for (const [key, value] of Object.entries(currencyPayload)) {
            // Map common aliases if needed, e.g. 'credits' -> 'credit'
            let k = key;
            if (k === 'credits') k = 'credit';

            if (validKeys.includes(k) && updates.system.currency[k] !== undefined) {
                updates.system.currency[k] = (updates.system.currency[k] ?? 0) + (value ?? 0);
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            await actor.update(updates);
        }
    }
}
