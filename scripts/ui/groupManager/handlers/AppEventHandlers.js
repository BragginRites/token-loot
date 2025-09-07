'use strict';

import { collapseAllSections } from '../services/CollapseManager.js';
import { uniqueGroupId } from '../../../utils/GroupUtils.js';

export class AppEventHandlers {
    /**
     * Set up top-level UI handlers (close, collapse-all, add-group)
     * @param {HTMLElement} overlay
     * @param {import('../services/GroupManagerState.js').GroupManagerState} state
     * @param {{ save: () => void }} autoSave
     * @param {() => Promise<void>} renderGroups
     * @param {Function} slugify
     * @param {Function} closeIfOpen
     */
    static setupAppEvents(overlay, state, autoSave, renderGroups, slugify, closeIfOpen) {
        // Close button
        overlay.querySelector('#tl-close')?.addEventListener('click', () => closeIfOpen());

        // Collapse all
        overlay.querySelector('#tl-collapse-all')?.addEventListener('click', () => {
            collapseAllSections();
        });

        // Add group
        overlay.querySelector('#tl-add')?.addEventListener('click', () => {
            const baseTitle = 'New Loot Group';
            const id = uniqueGroupId(state.getRules(), slugify(baseTitle) || 'group');
            state.addGroup(id, { id, name: baseTitle, actorUUIDs: [], currency: {}, distributionBlocks: [] });
            renderGroups();
            autoSave.save();
            const input = overlay.querySelector(`.tl-title[data-gid="${id}"]`);
            if (input) { input.focus(); input.select?.(); }
        });
    }
}
