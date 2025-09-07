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
     * @param {() => Promise<void>} renderGroups
     * @param {{ save: () => void }} autoSave
     */
    static async setupActorEvents(actorsEl, group, renderGroups, autoSave) {
        if (!actorsEl) return;

        // Drag/drop
        enableDroppable(actorsEl, async data => {
            if (data.type === 'Actor' && data.uuid) {
                group.actorUUIDs = group.actorUUIDs || [];
                if (!group.actorUUIDs.includes(data.uuid)) {
                    group.actorUUIDs.push(data.uuid);
                    await renderGroups();
                    autoSave.save();
                }
            } else if (data.type === 'Folder' && data.uuid) {
                try {
                    const folder = await fromUuid(data.uuid);
                    if (!folder) return;
                    const uuids = await collectActorsFromFolder(folder);
                    if (!uuids.length) return ui.notifications?.warn(`No actors found in folder "${folder.name}"`);
                    group.actorUUIDs = group.actorUUIDs || [];
                    const newOnes = uuids.filter(u => !group.actorUUIDs.includes(u));
                    if (!newOnes.length) return ui.notifications?.warn(`All actors from "${folder.name}" are already in this group.`);
                    group.actorUUIDs.push(...newOnes);
                    await renderGroups();
                    autoSave.save();
                    ui.notifications?.info(`Added ${newOnes.length} actors from "${folder.name}"`);
                } catch (e) {
                    console.warn(`${MODULE_ID} | Actor folder drop failed`, e);
                }
            }
        });

        // Render chips including delete behavior
        await this.renderActorChips(actorsEl, group.actorUUIDs || [], group, renderGroups, autoSave);
    }

    /**
     * Render actor chips with delete functionality
     */
    static async renderActorChips(actorsEl, actorUUIDs, group, renderGroups, autoSave) {
        actorsEl.innerHTML = '';
        for (const uuid of actorUUIDs) {
            const chip = await this.renderSingleActorChip(uuid);
            actorsEl.appendChild(chip);
            chip.querySelector('.tl-chip-delete')?.addEventListener('click', async () => {
                const { confirmDialog } = await import('../components/ContextMenu.js');
                const actor = await fromUuid(uuid);
                const ok = await confirmDialog('Remove Actor?', `Remove actor ${actor?.name || 'Unknown'} from group?`, { skipConfirm: false });
                if (!ok) return;
                group.actorUUIDs = (group.actorUUIDs || []).filter(u => u !== uuid);
                await renderGroups();
                autoSave.save();
            });
        }
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
        } catch {}
        return renderActorChip({ uuid, name, img });
    }
}
