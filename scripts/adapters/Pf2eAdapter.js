'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Pf2eAdapter extends SystemAdapter {
    getFilterProperties() {
        return [
            { key: 'name', label: 'Name', path: 'name', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'level', label: 'Level', path: 'system.details.level.value', valueType: 'number', uiControl: 'range', uiBounds: { min: -1, max: 25, step: 1 }, uiGroup: 'combat' },
            { key: 'type', label: 'Creature Type', path: 'system.details.creature.value', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'size', label: 'Size', path: 'system.traits.size.value', valueType: 'enum', options: this._sizeOptions(), uiControl: 'chips', uiGroup: 'identity' },
            { key: 'hp', label: 'Max HP', path: 'system.attributes.hp.max', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 999, step: 1 }, uiGroup: 'combat' },
            { key: 'ac', label: 'Armor Class', path: 'system.attributes.ac.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'combat' },
            { key: 'spellcaster', label: 'Has Spellcasting', path: '__special_spellcaster', valueType: 'boolean', uiControl: 'toggle', uiGroup: 'identity' },
            { key: 'custom', label: 'Custom Path', path: '__custom', valueType: 'text', uiControl: 'custom', uiGroup: 'advanced' }
        ];
    }

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

    _sizeOptions() {
        return [
            { value: 'tiny', label: 'Tiny' },
            { value: 'sm', label: 'Small' },
            { value: 'med', label: 'Medium' },
            { value: 'lg', label: 'Large' },
            { value: 'huge', label: 'Huge' },
            { value: 'grg', label: 'Gargantuan' }
        ];
    }
}
