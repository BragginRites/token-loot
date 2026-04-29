'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Sw5eAdapter extends SystemAdapter {
    getFilterProperties() {
        return [
            { key: 'name', label: 'Name', path: 'name', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'cr', label: 'CR / Level', path: 'system.details.cr', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 0.125 }, uiGroup: 'combat' },
            { key: 'type', label: 'Creature Type', path: 'system.details.type.value', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'size', label: 'Size', path: 'system.traits.size', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'alignment', label: 'Alignment', path: 'system.details.alignment', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'str', label: 'Strength', path: 'system.abilities.str.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'dex', label: 'Dexterity', path: 'system.abilities.dex.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'con', label: 'Constitution', path: 'system.abilities.con.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'int', label: 'Intelligence', path: 'system.abilities.int.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'wis', label: 'Wisdom', path: 'system.abilities.wis.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'cha', label: 'Charisma', path: 'system.abilities.cha.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'hp', label: 'Max HP', path: 'system.attributes.hp.max', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 999, step: 1 }, uiGroup: 'combat' },
            { key: 'ac', label: 'Armor Class', path: 'system.attributes.ac.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 40, step: 1 }, uiGroup: 'combat' },
            { key: 'spellcaster', label: 'Has Force/Tech Powers', path: '__special_spellcaster', valueType: 'boolean', uiControl: 'toggle', uiGroup: 'identity' },
            { key: 'custom', label: 'Custom Path', path: '__custom', valueType: 'text', uiControl: 'custom', uiGroup: 'advanced' }
        ];
    }

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

    /**
     * @override
     */
    getCurrencyConfiguration() {
        return {
            gc: 'Credits'
        };
    }
}
