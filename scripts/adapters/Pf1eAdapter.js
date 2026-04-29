'use strict';

import { SystemAdapter } from './SystemAdapter.js';

export class Pf1eAdapter extends SystemAdapter {
    getFilterProperties() {
        return [
            { key: 'name', label: 'Name', path: 'name', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'cr', label: 'CR', path: 'system.details.cr.total', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 0.125 }, uiGroup: 'combat' },
            { key: 'type', label: 'Creature Type', path: 'system.details.type', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'size', label: 'Size', path: 'system.traits.size', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'alignment', label: 'Alignment', path: 'system.details.alignment', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'str', label: 'Strength', path: 'system.abilities.str.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'dex', label: 'Dexterity', path: 'system.abilities.dex.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'con', label: 'Constitution', path: 'system.abilities.con.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'int', label: 'Intelligence', path: 'system.abilities.int.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'wis', label: 'Wisdom', path: 'system.abilities.wis.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'cha', label: 'Charisma', path: 'system.abilities.cha.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'abilities' },
            { key: 'hp', label: 'Max HP', path: 'system.attributes.hp.max', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 999, step: 1 }, uiGroup: 'combat' },
            { key: 'ac', label: 'Armor Class', path: 'system.attributes.ac.normal.total', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 50, step: 1 }, uiGroup: 'combat' },
            { key: 'custom', label: 'Custom Path', path: '__custom', valueType: 'text', uiControl: 'custom', uiGroup: 'advanced' }
        ];
    }

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
