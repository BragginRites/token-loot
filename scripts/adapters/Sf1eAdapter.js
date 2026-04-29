'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Sf1eAdapter extends SystemAdapter {
    getFilterProperties() {
        return [
            { key: 'name', label: 'Name', path: 'name', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'cr', label: 'CR', path: 'system.details.cr', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 0.125 }, uiGroup: 'combat' },
            { key: 'type', label: 'Creature Type', path: 'system.details.type', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'size', label: 'Size', path: 'system.traits.size', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'str', label: 'Strength', path: 'system.abilities.str.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'dex', label: 'Dexterity', path: 'system.abilities.dex.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'con', label: 'Constitution', path: 'system.abilities.con.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'int', label: 'Intelligence', path: 'system.abilities.int.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'wis', label: 'Wisdom', path: 'system.abilities.wis.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'cha', label: 'Charisma', path: 'system.abilities.cha.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'hp', label: 'Max HP', path: 'system.attributes.hp.max', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 999, step: 1 }, uiGroup: 'combat' },
            { key: 'eac', label: 'EAC', path: 'system.attributes.eac.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'combat' },
            { key: 'kac', label: 'KAC', path: 'system.attributes.kac.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'combat' },
            { key: 'custom', label: 'Custom Path', path: '__custom', valueType: 'text', uiControl: 'custom', uiGroup: 'advanced' }
        ];
    }

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

    /**
     * @override
     */
    getCurrencyConfiguration() {
        return {
            credit: 'Credits',
            upb: 'UPB'
        };
    }
}
