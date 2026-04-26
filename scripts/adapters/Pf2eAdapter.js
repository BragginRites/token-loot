'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Pf2eAdapter extends SystemAdapter {
    equipItem(itemData) {
        // PF2e uses system.equipped.carryType = 'worn' | 'held' | 'stowed'
        if (itemData.system?.equipped) {
            // Some items (like weapons) can be 'held' in 1 or 2 hands.
            // Armor is 'worn'. 
            // For auto-loot, 'worn' is usually the safest "equipped" state for armor/clothing.
            // Weapons in PF2e are often just added to inventory ('stowed') or 'held'.
            // We'll set to 'worn' if strictly armor, or 'held' if weapon?
            // "worn" works for Armor, Equipment. Weapons usually need to be held.

            const t = String(itemData.type || '').toLowerCase();
            if (t === 'armor' || t === 'equipment') {
                itemData.system.equipped.carryType = 'worn';
            } else if (t === 'weapon') {
                itemData.system.equipped.carryType = 'held';
                itemData.system.equipped.handsHeld = 1; // Default to 1 hand?
            }
        }

    }
    /**
     * @override
     */
    async addCurrency(actor, currencyPayload) {
        if (actor.inventory && typeof actor.inventory.addCoins === 'function') {
            await actor.inventory.addCoins(currencyPayload);
        } else {
            // Fallback to default if inventory module isn't available (unlikely in modern PF2e)
            super.addCurrency(actor, currencyPayload);
        }
    }

    /**
     * @override
     */
    getCurrencyConfiguration() {
        return {
            pp: 'PP',
            gp: 'GP',
            sp: 'SP',
            cp: 'CP'
        };
    }
}
