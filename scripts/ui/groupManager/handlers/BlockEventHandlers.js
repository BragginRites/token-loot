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
     * @param {Function} renderGroups - Function to re-render all groups
     * @param {Object} autoSave - AutoSave manager instance
     */
    static async setupBlockEvents(blockEl, block, group, renderGroups, autoSave) {
        // Set up collapse functionality
        this.setupCollapseEvents(blockEl, block, group);
        
        // Set up distribution type buttons
        this.setupDistributionButtons(blockEl, block, autoSave);
        
        // Set up configuration inputs
        this.setupConfigurationInputs(blockEl, block, autoSave);
        
        // Set initial visibility for config sections and item columns
        this.setInitialVisibility(blockEl, block);
        
        // Set initial visibility for chance bounds
        this.setChanceBoundsVisibility(blockEl, block);
        
        // Set up block name editing
        this.setupBlockNameEditor(blockEl, block, autoSave);
        
        // Set up block deletion
        this.setupBlockDeletion(blockEl, block, group, renderGroups, autoSave);
        
        // Set up export/import
        this.setupExportImport(blockEl, block, renderGroups, autoSave);
        
        // Set up items area
        await this.setupItemsArea(blockEl, block, renderGroups, autoSave);
        
        // Set up option chips (auto-equip, allow duplicates)
        this.setupOptionChips(blockEl, block, autoSave);
    }
    
    /**
     * Set up block collapse/expand functionality
     */
    static setupCollapseEvents(blockEl, block, group) {
        const blockHeader = blockEl.querySelector('.tl-block-hdr');
        const blockId = block.id || `block-${Date.now()}`;
        
        // Restore collapsed state
        const isCollapsed = getCollapsedState(group.id, `block-${blockId}`);
        if (isCollapsed) blockEl.classList.add('collapsed');
        
        blockHeader.addEventListener('click', (e) => {
            // Don't collapse if clicking on input fields or buttons
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
    
    /**
     * Set up distribution type buttons (All/Pick N/Chances)
     */
    static setupDistributionButtons(blockEl, block, autoSave) {
        blockEl.querySelectorAll('.tl-distribution-btn')?.forEach(btn => {
            btn.addEventListener('click', () => {
                const newType = btn.dataset.type;
                if (block.type === newType) return;
                
                block.type = newType;
                blockEl.querySelectorAll('.tl-distribution-btn').forEach(b => b.classList.remove('tl-active'));
                btn.classList.add('tl-active');
                
                // Update visibility for new type
                this.setInitialVisibility(blockEl, block);
                
                autoSave.saveDeferred();
            });
        });
    }
    
    /**
     * Set up configuration inputs (count, chance bounds, etc.)
     */
    static setupConfigurationInputs(blockEl, block, autoSave) {
        // Pick count
        blockEl.querySelector('.tl-distribution-count')?.addEventListener('change', ev => {
            block.count = Math.max(1, Number(ev.currentTarget.value || 1));
            autoSave.saveDeferred();
        });
        
        // Number of items toggle for chance blocks
        blockEl.querySelector('.tl-chip-force')?.addEventListener('click', ev => {
            const btn = ev.currentTarget;
            block.useChanceBounds = !block.useChanceBounds;
            btn.classList.toggle('tl-active', !!block.useChanceBounds);
            
            // Show/hide the bounds section
            this.setChanceBoundsVisibility(blockEl, block);
            
            autoSave.saveDeferred();
        });
        
        // Chance min/max
        blockEl.querySelector('.tl-ch-min')?.addEventListener('change', ev => {
            block.chanceMin = Math.max(0, Number(ev.currentTarget.value || 0));
            autoSave.saveDeferred();
        });
        blockEl.querySelector('.tl-ch-max')?.addEventListener('change', ev => {
            block.chanceMax = Math.max(0, Number(ev.currentTarget.value || 0));
            autoSave.saveDeferred();
        });
    }
    
    /**
     * Set up block name editing
     */
    static setupBlockNameEditor(blockEl, block, autoSave) {
        blockEl.querySelector('.tl-block-name')?.addEventListener('input', ev => {
            block.name = ev.currentTarget.value;
            autoSave.saveDeferred();
        });
    }
    
    /**
     * Set up block deletion
     */
    static setupBlockDeletion(blockEl, block, group, renderGroups, autoSave) {
        blockEl.querySelector('.tl-block-delete')?.addEventListener('click', async (ev) => {
            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const ok = await confirmDialog('Remove Block?', `Remove "${block.name || 'Block'}" distribution block?`, { skipConfirm });
            if (!ok) return;
            group.distributionBlocks = (group.distributionBlocks || []).filter(b => b !== block);
            renderGroups();
            autoSave.save();
        });
    }
    
    /**
     * Set up export/import functionality
     */
    static setupExportImport(blockEl, block, renderGroups, autoSave) {
        // Export block JSON as download
        blockEl.querySelector('.tl-block-export')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault?.();
            try {
                const items = await Promise.all((block.items || []).map(async r => {
                    let name = '';
                    try { const doc = await fromUuid(r.uuid); name = doc?.name || ''; } catch {}
                    return { uuid: r.uuid, name, chance: r.chance ?? 10, qtyMin: r.qtyMin ?? 1, qtyMax: r.qtyMax ?? 1 };
                }));

                // Build a minimal, ordered export structure
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

                // Prefer Foundry's helper when available
                if (typeof saveDataToFile === 'function') {
                    await saveDataToFile(jsonString, 'application/json', filename);
                } else {
                    // Fallback: force download via octet-stream to avoid inline preview
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
                        try { document.body.removeChild(a); } catch {}
                        try { URL.revokeObjectURL(url); } catch {}
                    }, 0);
                }
                
            } catch (err) {
                console.warn(`${MODULE_ID} | Block export failed`, err);
                ui.notifications?.error('Block export failed');
            }
        });
        
        // Import block JSON from file upload
        blockEl.querySelector('.tl-block-import')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Create file input
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
                        
                        // Preserve the current block ID to avoid conflicts
                        const currentId = block.id;
                        Object.assign(block, data);
                        block.id = currentId;
                        
                        renderGroups();
                        autoSave.save();
                        ui.notifications?.info(`Block "${block.name}" imported from ${file.name}`);
                    } catch (err) {
                        console.warn(`${MODULE_ID} | Block import failed`, err);
                        ui.notifications?.error(`Block import failed: ${err.message}`);
                    }
                    
                    // Clean up
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
     * Set up items area with drag-drop and item management
     */
    static async setupItemsArea(blockEl, block, renderGroups, autoSave) {
        const itemsRoot = blockEl.querySelector('.tl-items');
        
        // Enable drag-drop on items area
        enableDroppable(itemsRoot, async data => {
            if (data.type === 'Item' && data.uuid) {
                block.items = block.items || [];
                block.items.push({ uuid: data.uuid, chance: 10, qtyMin: 1, qtyMax: 1 });
                await renderGroups();
                autoSave.save();
            } else if (data.type === 'Folder' && data.uuid) {
                try {
                    const folder = await fromUuid(data.uuid);
                    if (!folder) return;
                    const itemUuids = await collectItemsFromFolder(folder);
                    if (!itemUuids.length) return ui.notifications?.warn(`No items found in folder "${folder.name}"`);
                    const existing = new Set((block.items || []).map(r => r.uuid));
                    const toAdd = itemUuids.filter(u => !existing.has(u));
                    block.items = block.items || [];
                    for (const u of toAdd) block.items.push({ uuid: u, chance: 10, qtyMin: 1, qtyMax: 1 });
                    await renderGroups();
                    autoSave.save();
                    ui.notifications?.info(`Added ${toAdd.length} items from "${folder.name}"`);
                } catch (e) {
                    console.warn(`${MODULE_ID} | Item folder drop failed`, e);
                }
            }
        });
        
        // Set up item row event handlers
        this.setupItemRowEvents(itemsRoot, block, renderGroups, autoSave);
    }
    
    /**
     * Set up option chips (auto-equip, allow duplicates)
     */
    static setupOptionChips(blockEl, block, autoSave) {
        // Auto-equip toggle
        blockEl.querySelector('.tl-chip-auto')?.addEventListener('click', ev => {
            const btn = ev.currentTarget;
            block.autoEquip = !block.autoEquip;
            btn.classList.toggle('tl-active', !!block.autoEquip);
            autoSave.saveDeferred();
        });
        
        // Allow duplicates toggle
        blockEl.querySelector('.tl-chip-dup')?.addEventListener('click', ev => {
            const btn = ev.currentTarget;
            block.allowDuplicates = !block.allowDuplicates;
            btn.classList.toggle('tl-active', !!block.allowDuplicates);
            autoSave.saveDeferred();
        });
    }
    
    /**
     * Set up item row events (deletion and editing)
     */
    static setupItemRowEvents(itemsRoot, block, renderGroups, autoSave) {
        // Item row deletions (event delegation on itemsRoot)
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
            renderGroups();
            autoSave.save();
        });

        // Persist edits to chance/qty inputs (event delegation on itemsRoot)
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
            // Ensure qtyMax >= qtyMin
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
    
    /**
     * Set initial visibility for config sections and item columns based on block type
     */
    static setInitialVisibility(blockEl, block) {
        const blockType = block.type || 'chance';
        
        // Update data-type attribute for CSS rules
        blockEl.setAttribute('data-type', blockType);
        
        // Show/hide config sections
        const pickCfg = blockEl.querySelector('.tl-config-pick');
        const chanceCfg = blockEl.querySelector('.tl-config-chance');
        if (pickCfg) pickCfg.style.display = (blockType === 'pick') ? '' : 'none';
        if (chanceCfg) chanceCfg.style.display = (blockType === 'chance') ? '' : 'none';
    }
    
    /**
     * Set visibility for chance bounds section based on useChanceBounds flag
     */
    static setChanceBoundsVisibility(blockEl, block) {
        const boundsEl = blockEl.querySelector('.tl-chance-bounds');
        if (boundsEl) {
            boundsEl.style.display = block.useChanceBounds ? '' : 'none';
        }
    }
}
