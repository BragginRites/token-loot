'use strict';

import { uniqueGroupId } from '../../../utils/GroupUtils.js';

export class AppEventHandlers {
    /**
     * Set up top-level UI handlers (close, add-group)
     * @param {HTMLElement} overlay
     * @param {import('../services/GroupManagerState.js').GroupManagerState} state
     * @param {{ save: () => void }} autoSave
     * @param {import('../GroupManagerController.js').GroupManagerController} controller
     * @param {Function} slugify
     * @param {Function} closeIfOpen
     */
    static setupAppEvents(overlay, state, autoSave, controller, slugify, closeIfOpen) {
        // Close button
        overlay.querySelector('#tl-close')?.addEventListener('click', () => closeIfOpen());

        // Add group - incremental append, no full re-render
        overlay.querySelector('#tl-add')?.addEventListener('click', async () => {
            const baseTitle = 'New Loot Group';
            const id = uniqueGroupId(state.getRules(), slugify(baseTitle) || 'group');
            state.addGroup(id, { id, name: baseTitle, actorUUIDs: [], currency: {}, distributionBlocks: [] });

            // Append just this card
            await controller.appendGroupCard(id);
            autoSave.save();

            // Focus the title input
            const input = overlay.querySelector(`.tl-title[data-gid="${id}"]`);
            if (input) { input.focus(); input.select?.(); }
        });
    }
}
