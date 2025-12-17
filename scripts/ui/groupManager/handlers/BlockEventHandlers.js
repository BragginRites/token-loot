'use strict';

import { MODULE_ID } from '../../../utils/settings.js';
import { saveCollapsedState, getCollapsedState } from '../services/CollapseManager.js';
import { collectItemsFromFolder } from '../../../utils/FolderUtils.js';
import { loadTemplate } from '../services/TemplateLoader.js';
import { renderItemRow } from '../components/ItemsList.js';
import { ItemValidator } from '../services/ItemValidator.js';
import { enableDroppable } from '../services/DragDropManager.js';

/**
 * Handles all event binding for distribution blocks
 */
export class BlockEventHandlers {

    /**
     * Set up all event handlers for a block element
     * @param {HTMLElement} blockEl - The block DOM element
     * @param {Object} block - The block data object
     * @param {Object} group - The parent group data object  
     * @param {Object} autoSave - AutoSave manager instance
     */
    static async setupBlockEvents(blockEl, block, group, autoSave) {
        this.setupCollapseEvents(blockEl, block, group);
        this.setupDistributionButtons(blockEl, block, autoSave);
        this.setupConfigurationInputs(blockEl, block, autoSave);
        this.setInitialVisibility(blockEl, block);
        this.setChanceBoundsVisibility(blockEl, block);
        this.setupBlockNameEditor(blockEl, block, autoSave);
        this.setupBlockDeletion(blockEl, block, group, autoSave);
        this.setupExportImport(blockEl, block, group, autoSave);
        await this.setupItemsArea(blockEl, block, autoSave);
        this.setupOptionChips(blockEl, block, autoSave);
    }

    static setupCollapseEvents(blockEl, block, group) {
        const blockHeader = blockEl.querySelector('.tl-block-hdr');
        const blockId = block.id || `block-${Date.now()}`;

        const isCollapsed = getCollapsedState(group.id, `block-${blockId}`);
        if (isCollapsed) blockEl.classList.add('collapsed');

        blockHeader.addEventListener('click', (e) => {
            if (e.target.closest('.tl-block-name') ||
                e.target.closest('.tl-distribution-buttons') ||
                e.target.closest('.tl-allow-dup') ||
                e.target.closest('.tl-option-chips') ||
                e.target.closest('.tl-chip') ||
                e.target.closest('.tl-block-delete')) return;

            blockEl.classList.toggle('collapsed');
            saveCollapsedState(group.id, `block-${blockId}`, blockEl.classList.contains('collapsed'));
        });
    }

    static setupDistributionButtons(blockEl, block, autoSave) {
        blockEl.querySelectorAll('.tl-distribution-btn')?.forEach(btn => {
            btn.addEventListener('click', () => {
                const newType = btn.dataset.type;
                if (block.type === newType) return;

                block.type = newType;
                blockEl.querySelectorAll('.tl-distribution-btn').forEach(b => b.classList.remove('tl-active'));
                btn.classList.add('tl-active');
                this.setInitialVisibility(blockEl, block);
                autoSave.saveDeferred();
            });
        });
    }

    static setupConfigurationInputs(blockEl, block, autoSave) {
        blockEl.querySelector('.tl-distribution-count')?.addEventListener('change', ev => {
            block.count = Math.max(1, Number(ev.currentTarget.value || 1));
            autoSave.saveDeferred();
        });

        blockEl.querySelector('.tl-chip-force')?.addEventListener('click', ev => {
            const btn = ev.currentTarget;
            block.useChanceBounds = !block.useChanceBounds;
            btn.classList.toggle('tl-active', !!block.useChanceBounds);
            this.setChanceBoundsVisibility(blockEl, block);
            autoSave.saveDeferred();
        });

        blockEl.querySelector('.tl-ch-min')?.addEventListener('change', ev => {
            block.chanceMin = Math.max(0, Number(ev.currentTarget.value || 0));
            autoSave.saveDeferred();
        });
        blockEl.querySelector('.tl-ch-max')?.addEventListener('change', ev => {
            block.chanceMax = Math.max(0, Number(ev.currentTarget.value || 0));
            autoSave.saveDeferred();
        });
    }

    static setupBlockNameEditor(blockEl, block, autoSave) {
        blockEl.querySelector('.tl-block-name')?.addEventListener('input', ev => {
            block.name = ev.currentTarget.value;
            autoSave.saveDeferred();
        });
    }

    /**
     * Block deletion - removes block element from DOM
     */
    static setupBlockDeletion(blockEl, block, group, autoSave) {
        blockEl.querySelector('.tl-block-delete')?.addEventListener('click', async (ev) => {
            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const ok = await confirmDialog('Remove Block?', `Remove "${block.name || 'Block'}" distribution block?`, { skipConfirm });
            if (!ok) return;
            group.distributionBlocks = (group.distributionBlocks || []).filter(b => b !== block);
            blockEl.remove();
            autoSave.save();
        });
    }

    static setupExportImport(blockEl, block, group, autoSave) {
        blockEl.querySelector('.tl-block-export')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault?.();
            try {
                const items = await Promise.all((block.items || []).map(async r => {
                    let name = '';
                    try { const doc = await fromUuid(r.uuid); name = doc?.name || ''; } catch { }
                    return { uuid: r.uuid, name, chance: r.chance ?? 10, qtyMin: r.qtyMin ?? 1, qtyMax: r.qtyMax ?? 1 };
                }));

                const data = {
                    id: block.id,
                    name: block.name || 'Block',
                    type: block.type || 'chance',
                    count: block.count ?? 1,
                    useChanceBounds: !!block.useChanceBounds,
                    allowDuplicates: !!block.allowDuplicates,
                    autoEquip: !!block.autoEquip,
                    items
                };

                const jsonString = JSON.stringify(data, null, 2);
                const filename = `${block.name || 'block'}.json`;

                if (typeof saveDataToFile === 'function') {
                    await saveDataToFile(jsonString, 'application/json', filename);
                } else {
                    const blob = new Blob([jsonString], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.rel = 'noopener';
                    a.target = '_self';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        try { document.body.removeChild(a); } catch { }
                        try { URL.revokeObjectURL(url); } catch { }
                    }, 0);
                }

            } catch (err) {
                console.warn(`${MODULE_ID} | Block export failed`, err);
                ui.notifications?.error('Block export failed');
            }
        });

        // Import - refreshes just this block's items area
        blockEl.querySelector('.tl-block-import')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json';
                fileInput.style.display = 'none';

                fileInput.addEventListener('change', async (event) => {
                    const file = event.target.files[0];
                    if (!file) return;

                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        if (!data.items || !Array.isArray(data.items)) {
                            throw new Error('Invalid block format - missing items array');
                        }

                        const currentId = block.id;
                        Object.assign(block, data);
                        block.id = currentId;

                        // Refresh just this block's items
                        const itemsRoot = blockEl.querySelector('.tl-items');
                        await this.refreshItemsArea(itemsRoot, block, autoSave);

                        autoSave.save();

                    } catch (err) {
                        console.warn(`${MODULE_ID} | Block import failed`, err);
                        ui.notifications?.error(`Block import failed: ${err.message}`);
                    }

                    document.body.removeChild(fileInput);
                });

                document.body.appendChild(fileInput);
                fileInput.click();
            } catch (err) {
                console.warn(`${MODULE_ID} | Block import setup failed`, err);
                ui.notifications?.error('Block import failed');
            }
        });
    }

    /**
     * Set up items area with incremental drag-drop
     */
    static async setupItemsArea(blockEl, block, autoSave) {
        const itemsRoot = blockEl.querySelector('.tl-items');

        // Enable drag-drop - incremental append
        enableDroppable(itemsRoot, async data => {
            if (data.type === 'Item' && data.uuid) {
                block.items = block.items || [];
                if (!block.items.some(i => i.uuid === data.uuid)) {
                    const newItem = { uuid: data.uuid, chance: 10, qtyMin: 1, qtyMax: 1 };
                    block.items.push(newItem);
                    await this.appendItemRow(itemsRoot, newItem, block, autoSave);
                    autoSave.save();
                }
            } else if (data.type === 'Folder' && data.uuid) {
                try {
                    const folder = await fromUuid(data.uuid);
                    if (!folder) return;
                    // Only accept Item folders
                    if (folder.type !== 'Item') return;
                    const itemUuids = await collectItemsFromFolder(folder);
                    if (!itemUuids.length) return;
                    const existing = new Set((block.items || []).map(r => r.uuid));
                    const toAdd = itemUuids.filter(u => !existing.has(u));
                    if (!toAdd.length) return;

                    block.items = block.items || [];
                    for (const uuid of toAdd) {
                        const newItem = { uuid, chance: 10, qtyMin: 1, qtyMax: 1 };
                        block.items.push(newItem);
                        await this.appendItemRow(itemsRoot, newItem, block, autoSave);
                    }
                    autoSave.save();

                } catch (e) {
                    console.warn(`${MODULE_ID} | Item folder drop failed`, e);
                }
            }
        });

        // Set up item row events (uses event delegation)
        this.setupItemRowEvents(itemsRoot, block, autoSave);
    }

    /**
     * Append a single item row to the items container
     */
    static async appendItemRow(itemsRoot, item, block, autoSave) {
        // Remove hint if present
        const hint = itemsRoot.querySelector('.tl-hint');
        if (hint) hint.remove();

        let docName = 'Loading...';
        let docImg = 'icons/svg/item-bag.svg';

        try {
            const doc = await fromUuid(item.uuid);
            if (doc) {
                docName = doc.name;
                docImg = doc.img;
            } else {
                docName = 'Unknown Item';
            }
        } catch { }

        const rowEl = await renderItemRow({
            ...item,
            name: docName,
            img: docImg,
            showChance: block.type === 'chance'
        });
        itemsRoot.appendChild(rowEl);
    }

    /**
     * Refresh entire items area (for import)
     */
    static async refreshItemsArea(itemsRoot, block, autoSave) {
        // Clear and rebuild items (not full group re-render)
        const header = itemsRoot.querySelector('.tl-item-header');
        itemsRoot.innerHTML = '';
        if (header) itemsRoot.appendChild(header);

        if (!block.items || block.items.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'tl-hint';
            hint.textContent = 'Drag items or folders of items here';
            itemsRoot.appendChild(hint);
        } else {
            for (const item of block.items) {
                await this.appendItemRow(itemsRoot, item, block, autoSave);
            }
        }
    }

    static setupOptionChips(blockEl, block, autoSave) {
        blockEl.querySelector('.tl-chip-auto')?.addEventListener('click', ev => {
            const btn = ev.currentTarget;
            block.autoEquip = !block.autoEquip;
            btn.classList.toggle('tl-active', !!block.autoEquip);
            autoSave.saveDeferred();
        });

        blockEl.querySelector('.tl-chip-dup')?.addEventListener('click', ev => {
            const btn = ev.currentTarget;
            block.allowDuplicates = !block.allowDuplicates;
            btn.classList.toggle('tl-active', !!block.allowDuplicates);
            autoSave.saveDeferred();
        });
    }

    /**
     * Set up item row events - incremental deletion
     */
    static setupItemRowEvents(itemsRoot, block, autoSave) {
        itemsRoot.addEventListener('click', async (ev) => {
            const del = ev.target.closest('.tl-item-delete');
            if (!del) return;
            const rowEl = ev.target.closest('.tl-item-row');
            const uuid = rowEl?.getAttribute('data-uuid');
            if (!uuid) return;

            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const ok = await confirmDialog('Remove Item?', 'Remove selected item from this block?', { skipConfirm });
            if (!ok) return;

            block.items = (block.items || []).filter(r => r.uuid !== uuid);
            rowEl.remove();

            // Show hint if empty
            if ((block.items || []).length === 0) {
                const hint = document.createElement('div');
                hint.className = 'tl-hint';
                hint.textContent = 'Drag items or folders of items here';
                itemsRoot.appendChild(hint);
            }
            autoSave.save();
        });

        const persistEdit = (ev) => {
            const input = ev.target;
            const rowEl = input.closest?.('.tl-item-row');
            if (!rowEl) return;
            const uuid = rowEl.getAttribute('data-uuid');
            if (!uuid) return;
            const entry = (block.items || []).find(r => r.uuid === uuid);
            if (!entry) return;
            const toNumber = (v, def) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : def;
            };
            let changed = false;
            if (input.classList.contains('tl-item-chance')) {
                const val = Math.max(0, Math.min(100, toNumber(input.value, entry.chance ?? 10)));
                if (val !== entry.chance) { entry.chance = val; changed = true; }
                if (String(input.value) !== String(val)) input.value = String(val);
            } else if (input.classList.contains('tl-item-qtymin')) {
                const val = Math.max(0, toNumber(input.value, entry.qtyMin ?? 1));
                if (val !== entry.qtyMin) { entry.qtyMin = val; changed = true; }
            } else if (input.classList.contains('tl-item-qtymax')) {
                const val = Math.max(0, toNumber(input.value, entry.qtyMax ?? 1));
                if (val !== entry.qtyMax) { entry.qtyMax = val; changed = true; }
            }
            if (entry.qtyMin != null && entry.qtyMax != null && entry.qtyMax < entry.qtyMin) {
                entry.qtyMax = entry.qtyMin;
                const maxEl = rowEl.querySelector('.tl-item-qtymax');
                if (maxEl) maxEl.value = String(entry.qtyMax);
                changed = true;
            }
            if (changed) autoSave.saveDeferred();
        };
        itemsRoot.addEventListener('change', persistEdit);
        itemsRoot.addEventListener('input', persistEdit);
    }

    static setInitialVisibility(blockEl, block) {
        const blockType = block.type || 'chance';
        blockEl.setAttribute('data-type', blockType);
        const pickCfg = blockEl.querySelector('.tl-config-pick');
        const chanceCfg = blockEl.querySelector('.tl-config-chance');
        if (pickCfg) pickCfg.style.display = (blockType === 'pick') ? '' : 'none';
        if (chanceCfg) chanceCfg.style.display = (blockType === 'chance') ? '' : 'none';
    }

    static setChanceBoundsVisibility(blockEl, block) {
        const boundsEl = blockEl.querySelector('.tl-chance-bounds');
        if (boundsEl) {
            boundsEl.style.display = block.useChanceBounds ? '' : 'none';
        }
    }
}
