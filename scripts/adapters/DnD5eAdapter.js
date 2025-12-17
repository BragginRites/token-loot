'use strict';

import { SystemAdapter } from './SystemAdapter.js';
import { MODULE_ID } from '../utils/settings.js';

export class DnD5eAdapter extends SystemAdapter {
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
}
