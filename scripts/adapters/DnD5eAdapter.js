'use strict';

import { SystemAdapter } from './SystemAdapter.js';
import { MODULE_ID } from '../utils/settings.js';

export class DnD5eAdapter extends SystemAdapter {
    getFilterProperties() {
        return [
            { key: 'name', label: 'Name', path: 'name', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'cr', label: 'CR / Level', path: 'system.details.cr', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 0.125 }, uiGroup: 'combat' },
            { key: 'type', label: 'Creature Type', path: 'system.details.type.value', valueType: 'enum', configPath: 'DND5E.creatureTypes', uiControl: 'chips', uiGroup: 'identity' },
            { key: 'size', label: 'Size', path: 'system.traits.size', valueType: 'enum', configPath: 'DND5E.actorSizes', uiControl: 'chips', uiGroup: 'identity' },
            { key: 'alignment', label: 'Alignment', path: 'system.details.alignment', valueType: 'enum', configPath: 'DND5E.alignments', uiControl: 'chips', uiGroup: 'identity' },
            { key: 'str', label: 'Strength', path: 'system.abilities.str.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'dex', label: 'Dexterity', path: 'system.abilities.dex.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'con', label: 'Constitution', path: 'system.abilities.con.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'int', label: 'Intelligence', path: 'system.abilities.int.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'wis', label: 'Wisdom', path: 'system.abilities.wis.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'cha', label: 'Charisma', path: 'system.abilities.cha.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 30, step: 1 }, uiGroup: 'abilities' },
            { key: 'hp', label: 'Max HP', path: 'system.attributes.hp.max', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 999, step: 1 }, uiGroup: 'combat' },
            { key: 'ac', label: 'Armor Class', path: 'system.attributes.ac.value', valueType: 'number', uiControl: 'range', uiBounds: { min: 0, max: 40, step: 1 }, uiGroup: 'combat' },
            { key: 'spellcaster', label: 'Has Spellcasting', path: '__special_spellcaster', valueType: 'boolean', uiControl: 'toggle', uiGroup: 'identity' },
            { key: 'custom', label: 'Custom Path', path: '__custom', valueType: 'text', uiControl: 'custom', uiGroup: 'advanced' }
        ];
    }

    shouldEquipItemType(type) {
        const t = String(type || '').toLowerCase();
        return ['weapon', 'armor', 'equipment', 'tool', 'backpack'].includes(t);
    }

    equipItem(itemData) {
        if (this.shouldEquipItemType(itemData.type)) {
            if (itemData.system) {
                // system.equipped is a boolean for these types.
                if (typeof itemData.system.equipped === 'boolean') {
                    itemData.system.equipped = true;
                }
            }
        }
    }

    async createScroll(item) {
        try {
            // Try standard D&D 5e API
            let scrollData = null;

            // Create scroll using system API
            if (game.dnd5e?.documents?.Item5e?.createScrollFromSpell) {
                const created = await game.dnd5e.documents.Item5e.createScrollFromSpell(item);
                scrollData = created?.toObject ? created.toObject() : created;
                // Return clean data
                if (scrollData && scrollData._id) delete scrollData._id;
                return scrollData;
            }
        } catch (e) {
            console.warn(`${MODULE_ID} | DnD5eAdapter createScroll failed`, e);
        }
        return null;
    }

    /**
     * @override
     */
    getCurrencyConfiguration() {
        return {
            pp: 'PP',
            gp: 'GP',
            ep: 'EP',
            sp: 'SP',
            cp: 'CP'
        };
    }
}
