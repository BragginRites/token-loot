'use strict';

import { MODULE_ID } from '../../../utils/settings.js';
import { enableDroppable } from '../services/DragDropManager.js';
import { collectActorsFromFolder } from '../../../utils/FolderUtils.js';
import { renderActorChip } from '../components/ActorChips.js';

export class ActorEventHandlers {
    /**
     * Wire up drag-drop area and chip delete events for the actors section
     * @param {HTMLElement} actorsEl
     * @param {{ actorUUIDs?: string[] }} group
     * @param {{ save: () => void }} autoSave
     */
    static async setupActorEvents(actorsEl, group, autoSave) {
        if (!actorsEl) return;

        // Drag/drop - incremental append
        enableDroppable(actorsEl, async data => {
            if (data.type === 'Actor' && data.uuid) {
                group.actorUUIDs = group.actorUUIDs || [];
                if (!group.actorUUIDs.includes(data.uuid)) {
                    group.actorUUIDs.push(data.uuid);
                    await this.appendActorChip(actorsEl, data.uuid, group, autoSave);
                    autoSave.save();
                }
            } else if (data.type === 'Folder' && data.uuid) {
                try {
                    const folder = await fromUuid(data.uuid);
                    if (!folder) return;
                    // Only accept Actor folders
                    if (folder.type !== 'Actor') return;
                    const uuids = await collectActorsFromFolder(folder);
                    if (!uuids.length) return;
                    group.actorUUIDs = group.actorUUIDs || [];
                    const newOnes = uuids.filter(u => !group.actorUUIDs.includes(u));
                    if (!newOnes.length) return;

                    for (const uuid of newOnes) {
                        group.actorUUIDs.push(uuid);
                        await this.appendActorChip(actorsEl, uuid, group, autoSave);
                    }
                    autoSave.save();

                } catch (e) {
                    console.warn(`${MODULE_ID} | Actor folder drop failed`, e);
                }
            }
        });

        // Initial render of chips
        await this.renderActorChips(actorsEl, group.actorUUIDs || [], group, autoSave);
    }

    /**
     * Render all actor chips (initial load only)
     */
    static async renderActorChips(actorsEl, actorUUIDs, group, autoSave) {
        actorsEl.innerHTML = '';
        if (!actorUUIDs || actorUUIDs.length === 0) {
            actorsEl.innerHTML = '<div class="tl-hint">Drop Actors or Folders here</div>';
            return;
        }
        for (const uuid of actorUUIDs) {
            await this.appendActorChip(actorsEl, uuid, group, autoSave);
        }
    }

    /**
     * Append a single actor chip to the container
     */
    static async appendActorChip(actorsEl, uuid, group, autoSave) {
        // Remove hint if present
        const hint = actorsEl.querySelector('.tl-hint');
        if (hint) hint.remove();

        const chip = await this.renderSingleActorChip(uuid);
        actorsEl.appendChild(chip);

        // Delete button - removes chip from DOM
        chip.querySelector('.tl-chip-delete')?.addEventListener('click', async (ev) => {
            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const actor = await fromUuid(uuid);
            const ok = await confirmDialog('Remove Actor?', `Remove actor ${actor?.name || 'Unknown'} from group?`, { skipConfirm });
            if (!ok) return;

            group.actorUUIDs = (group.actorUUIDs || []).filter(u => u !== uuid);
            chip.remove();

            // Show hint if empty
            if ((group.actorUUIDs || []).length === 0) {
                actorsEl.innerHTML = '<div class="tl-hint">Drop Actors or Folders here</div>';
            }
            autoSave.save();
        });
    }

    /**
     * Render a single actor chip resolving name/image
     */
    static async renderSingleActorChip(uuid) {
        let name = '';
        let img = '';
        try {
            const doc = await fromUuid(uuid);
            name = doc?.name || '';
            img = doc?.img || '';
        } catch { }
        return renderActorChip({ uuid, name, img });
    }

    /**
     * Clear all actor chips (used by "Clear All" action)
     */
    static clearActorChips(actorsEl) {
        if (!actorsEl) return;
        actorsEl.innerHTML = '<div class="tl-hint">Drop Actors or Folders here</div>';
    }
}
