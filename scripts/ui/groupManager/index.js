'use strict';

import { MODULE_ID, getWorldRuleSet, saveWorldRuleSet, slugify } from '../../utils/settings.js';
import { loadTemplate } from './services/TemplateLoader.js';
import { makeDraggable, makeResizable, loadSavedSize } from './services/ResizeManager.js';
import { openBlockContextMenu } from './components/ContextMenu.js';
import { enableDroppable } from './services/DragDropManager.js';
import { renderGroupCard } from './components/GroupCard.js';
import { renderDistributionBlock } from './components/DistributionBlock.js';
import { renderItemRow } from './components/ItemsList.js';
import { renderActorChip } from './components/ActorChips.js';
import { bindCurrencyForm } from './components/CurrencyForm.js';

const OVERLAY_ID = 'tl-group-manager';

// Helper functions for section collapse state
function getCollapsedState(groupId, sectionId) {
    const key = `tl-collapsed-${groupId}-${sectionId}`;
    return localStorage.getItem(key) === 'true';
}

function saveCollapsedState(groupId, sectionId, isCollapsed) {
    const key = `tl-collapsed-${groupId}-${sectionId}`;
    if (isCollapsed) {
        localStorage.setItem(key, 'true');
    } else {
        localStorage.removeItem(key);
    }
}

function collapseAllSections() {
    // Collapse all groups
    const groups = document.querySelectorAll('#tl-group-manager .tl-card');
    groups.forEach(group => {
        group.classList.add('collapsed');
        const groupId = group.dataset.gid;
        saveCollapsedState(groupId, 'group', true);
    });
    
    // Collapse all sections within groups
    const sections = document.querySelectorAll('#tl-group-manager .tl-section');
    sections.forEach(section => {
        section.classList.add('collapsed');
        const groupId = section.closest('.tl-card').dataset.gid;
        const sectionId = section.dataset.section;
        saveCollapsedState(groupId, sectionId, true);
    });
}

export async function openGroupManager() {
    closeIfOpen();
    const state = { rules: structuredClone(getWorldRuleSet()) };
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = await loadTemplate('groupManager.html');
    document.body.appendChild(overlay);

    const panel = overlay.querySelector('.tl-panel');
    const dragHandle = overlay.querySelector('#tl-drag');
    makeDraggable(panel, dragHandle);
    makeResizable(panel);
    loadSavedSize(panel);

    // Wire basic actions; detailed componentization will migrate from legacy file
    overlay.querySelector('#tl-close')?.addEventListener('click', () => closeIfOpen());

    // Collapse all sections
    overlay.querySelector('#tl-collapse-all')?.addEventListener('click', () => {
        collapseAllSections();
    });

    // Add group
    overlay.querySelector('#tl-add')?.addEventListener('click', () => {
        const baseTitle = 'New Loot Group';
        const id = uniqueGroupId(state.rules, slugify(baseTitle) || 'group');
        state.rules.groups[id] = { id, name: baseTitle, actorUUIDs: [], currency: {}, distributionBlocks: [] };
        renderGroups();
        autosave();
        const input = overlay.querySelector(`.tl-title[data-gid="${id}"]`);
        if (input) { input.focus(); input.select?.(); }
    });

    const listEl = overlay.querySelector('#tl-groups');

    function autosave() { saveWorldRuleSet(state.rules); }
    let saveTimer = null;
    function autosaveDeferred() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(() => autosave(), 400); }

    async function renderGroups() {
        listEl.innerHTML = '';
        const gids = Object.keys(state.rules.groups || {});
        if (gids.length === 0) {
            listEl.innerHTML = `<div class="tl-empty">No groups yet. Click "Add Loot Group".</div>`;
            return;
        }
        for (const gid of gids) {
            const group = state.rules.groups[gid];
            const card = await renderGroupCard(group);
            listEl.appendChild(card);

            // Title
            card.querySelector('.tl-title')?.addEventListener('input', ev => { group.name = ev.currentTarget.value; autosaveDeferred(); });

            // Currency form
            bindCurrencyForm(card, group, autosaveDeferred);

            // Actors area
            const actorsEl = card.querySelector('.tl-actors');
            enableDroppable(actorsEl, async data => {
                if (data.type === 'Actor' && data.uuid) {
                    group.actorUUIDs = group.actorUUIDs || [];
                    // Allow actors to be in multiple groups - no restriction check
                    if (!group.actorUUIDs.includes(data.uuid)) {
                        group.actorUUIDs.push(data.uuid);
                        await renderGroups();
                        autosave();
                    }
                } else if (data.type === 'Folder' && data.uuid) {
                    try {
                        const folder = await fromUuid(data.uuid);
                        if (!folder) return;
                        const uuids = await collectActorsFromFolder(folder);
                        if (!uuids.length) return ui.notifications?.warn(`No actors found in folder "${folder.name}"`);
                        group.actorUUIDs = group.actorUUIDs || [];
                        // Filter out actors already in THIS group (but allow duplicates across groups)
                        const newOnes = uuids.filter(u => !group.actorUUIDs.includes(u));
                        if (!newOnes.length) return ui.notifications?.warn(`All actors from "${folder.name}" are already in this group.`);
                        group.actorUUIDs.push(...newOnes);
                        await renderGroups();
                        autosave();
                        ui.notifications?.info(`Added ${newOnes.length} actors from "${folder.name}"`);
                    } catch (e) {
                        console.warn(`${MODULE_ID} | Actor folder drop failed`, e);
                    }
                }
            });
            await renderActorChips(actorsEl, group.actorUUIDs || []);

            // Blocks
            const blocksEl = card.querySelector('.tl-distribution-blocks');
            for (const block of (group.distributionBlocks || [])) {
                const blockEl = await renderDistributionBlock(block);
                blocksEl.appendChild(blockEl);
                
                // Block collapse functionality
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
                        e.target.closest('.tl-block-delete')) return;
                    
                    blockEl.classList.toggle('collapsed');
                    saveCollapsedState(group.id, `block-${blockId}`, blockEl.classList.contains('collapsed'));
                });
                
                // Items list
                const itemsRoot = blockEl.querySelector('.tl-items');
                // Render header once per block
                const headerHtml = await loadTemplate('itemHeader.html', { chanceHeaderDisplay: (block.type === 'chance') ? '' : 'style="display:none"' });
                const headerWrap = document.createElement('div');
                headerWrap.innerHTML = headerHtml.trim();
                itemsRoot.appendChild(headerWrap.firstElementChild);
                for (const row of (block.items || [])) {
                    const rowData = { ...row, showChance: block.type === 'chance' };
                    itemsRoot.appendChild(await renderItemRow(rowData));
                }
                if (!((block.items || []).length)) {
                    const hint = document.createElement('div');
                    hint.className = 'tl-hint';
                    hint.textContent = 'Drag items or folders of items here';
                    itemsRoot.appendChild(hint);
                }
                enableDroppable(itemsRoot, async data => {
                    if (data.type === 'Item' && data.uuid) {
                        block.items = block.items || [];
                        block.items.push({ uuid: data.uuid, chance: 100, qtyMin: 1, qtyMax: 1 });
                        await renderGroups();
                        autosave();
                    } else if (data.type === 'Folder' && data.uuid) {
                        try {
                            const folder = await fromUuid(data.uuid);
                            if (!folder) return;
                            const itemUuids = await collectItemsFromFolder(folder);
                            if (!itemUuids.length) return ui.notifications?.warn(`No items found in folder "${folder.name}"`);
                            const existing = new Set((block.items || []).map(r => r.uuid));
                            const toAdd = itemUuids.filter(u => !existing.has(u));
                            block.items = block.items || [];
                            for (const u of toAdd) block.items.push({ uuid: u, chance: 100, qtyMin: 1, qtyMax: 1 });
                            await renderGroups();
                            autosave();
                            ui.notifications?.info(`Added ${toAdd.length} items from "${folder.name}"`);
                        } catch (e) {
                            console.warn(`${MODULE_ID} | Item folder drop failed`, e);
                        }
                    }
                });
                // Block type and allow duplicates
                blockEl.querySelectorAll('.tl-distribution-btn')?.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const type = btn.getAttribute('data-type');
                        block.type = type || 'all';
                        renderGroups();
                        autosave();
                    });
                });
                blockEl.querySelector('.tl-allow-dup-input')?.addEventListener('change', ev => {
                    block.allowDuplicates = !!ev.currentTarget.checked;
                    autosaveDeferred();
                });
                // Pick N count
                blockEl.querySelector('.tl-distribution-count')?.addEventListener('change', ev => {
                    block.count = Math.max(1, Number(ev.currentTarget.value || 1));
                    autosaveDeferred();
                });
                // Chance min/max
                blockEl.querySelector('.tl-ch-min')?.addEventListener('change', ev => {
                    block.chanceMin = Math.max(0, Number(ev.currentTarget.value || 0));
                    autosaveDeferred();
                });
                blockEl.querySelector('.tl-ch-max')?.addEventListener('change', ev => {
                    block.chanceMax = Math.max(0, Number(ev.currentTarget.value || 0));
                    autosaveDeferred();
                });

                // Ensure only the relevant config is visible
                const pickCfg = blockEl.querySelector('.tl-config-pick');
                const chanceCfg = blockEl.querySelector('.tl-config-chance');
                if (pickCfg) pickCfg.style.display = (block.type === 'pick') ? '' : 'none';
                if (chanceCfg) chanceCfg.style.display = (block.type === 'chance') ? '' : 'none';

                // Remove block
                blockEl.querySelector('.tl-block-delete')?.addEventListener('click', async (ev) => {
                    const { confirmDialog } = await import('./components/ContextMenu.js');
                    const skipConfirm = !!ev.shiftKey;
                    const ok = await confirmDialog('Remove Block?', `Remove "${block.name || 'Block'}" distribution block?`, { skipConfirm });
                    if (!ok) return;
                    group.distributionBlocks = (group.distributionBlocks || []).filter(b => b !== block);
                    renderGroups();
                    autosave();
                });

                // Item row deletions (event delegation on itemsRoot)
                itemsRoot.addEventListener('click', async (ev) => {
                    const del = ev.target.closest('.tl-item-delete');
                    if (!del) return;
                    const rowEl = ev.target.closest('.tl-item-row');
                    const uuid = rowEl?.getAttribute('data-uuid');
                    if (!uuid) return;
                    const { confirmDialog } = await import('./components/ContextMenu.js');
                    const skipConfirm = !!ev.shiftKey;
                    const ok = await confirmDialog('Remove Item?', 'Remove selected item from this block?', { skipConfirm });
                    if (!ok) return;
                    block.items = (block.items || []).filter(r => r.uuid !== uuid);
                    renderGroups();
                    autosave();
                });
            }
            // Add block button (now handled in template with event delegation)
            const addBlockBtn = card.querySelector('.tl-add-block');
            if (addBlockBtn) {
                addBlockBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent section header click
                    group.distributionBlocks = group.distributionBlocks || [];
                    const blockId = `block-${Date.now()}`;
                    group.distributionBlocks.push({ id: blockId, name: 'New Block', type: 'all', count: 1, allowDuplicates: false, items: [] });
                    renderGroups();
                    autosave();
                });
            }

            // Group collapse functionality
            const cardHeader = card.querySelector('.tl-card-hdr');
            const groupId = group.id;
            
            // Restore group collapsed state
            const isGroupCollapsed = getCollapsedState(groupId, 'group');
            if (isGroupCollapsed) {
                card.classList.add('collapsed');
            }
            
            cardHeader.addEventListener('click', (e) => {
                // Don't collapse if clicking on title input or buttons
                if (e.target.closest('.tl-title') || e.target.closest('.tl-card-actions')) return;
                
                card.classList.toggle('collapsed');
                saveCollapsedState(groupId, 'group', card.classList.contains('collapsed'));
            });

            // Section collapse functionality
            const sections = card.querySelectorAll('.tl-section');
            sections.forEach(section => {
                const header = section.querySelector('.tl-section-header');
                const sectionId = section.dataset.section;
                
                // Restore collapsed state from storage
                const isCollapsed = getCollapsedState(groupId, sectionId);
                if (isCollapsed) {
                    section.classList.add('collapsed');
                }
                
                header.addEventListener('click', (e) => {
                    // Don't collapse if clicking on buttons
                    if (e.target.closest('.tl-section-actions')) return;
                    
                    section.classList.toggle('collapsed');
                    saveCollapsedState(groupId, sectionId, section.classList.contains('collapsed'));
                });
            });

            // Clear all actors
            card.querySelector('.tl-clear-actors')?.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent section header click
                
                const { confirmDialog } = await import('./dialogs/ConfirmDialog.js');
                const confirmed = await confirmDialog(
                    'Clear All Actors',
                    `Are you sure you want to remove all actors from "${group.name}"?`,
                    { danger: true }
                );
                
                if (confirmed) {
                    group.actorUUIDs = [];
                    renderGroups();
                    autosave();
                }
            });

            // Duplicate group
            card.querySelector('.tl-duplicate')?.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent header click
                const originalGroup = group;
                const baseTitle = `${originalGroup.name} Copy`;
                const id = uniqueGroupId(state.rules, slugify(baseTitle) || 'group');
                
                // Deep clone the group
                const duplicatedGroup = {
                    ...structuredClone(originalGroup),
                    id,
                    name: baseTitle
                };
                
                // Generate new IDs for distribution blocks and items
                if (duplicatedGroup.distributionBlocks) {
                    duplicatedGroup.distributionBlocks = duplicatedGroup.distributionBlocks.map(block => ({
                        ...block,
                        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    }));
                }
                
                state.rules.groups[id] = duplicatedGroup;
                renderGroups();
                autosave();
            });

            // Delete group
            card.querySelector('.tl-delete')?.addEventListener('click', async (ev) => {
                const { confirmDialog } = await import('./components/ContextMenu.js');
                const skipConfirm = !!ev.shiftKey;
                const ok = await confirmDialog('Delete Loot Group?', `Are you sure you want to delete "${group.name || group.id}"?`, { skipConfirm });
                if (!ok) return;
                delete state.rules.groups[group.id];
                renderGroups();
                autosave();
            });
        }

        resolveNamesIn(listEl);
    }

    async function renderActorChips(root, uuids) {
        root.innerHTML = '';
        if (!uuids.length) {
            const hint = document.createElement('div');
            hint.className = 'tl-hint';
            hint.textContent = 'Drag individual actors or folders of actors here';
            root.appendChild(hint);
            return;
        }
        for (const uuid of uuids) {
            const chip = await renderActorChip({ uuid, name: shortName(uuid), img: '' });
            root.appendChild(chip);
        }
        // Delete chip
        root.addEventListener('click', ev => {
            const btn = ev.target.closest('.tl-chip-delete');
            if (!btn) return;
            const chip = ev.target.closest('.tl-chip');
            const uuid = chip?.getAttribute('data-uuid');
            const gid = ev.target.closest('.tl-card')?.getAttribute('data-gid');
            const g = gid ? state.rules.groups[gid] : null;
            if (!g || !uuid) return;
            g.actorUUIDs = (g.actorUUIDs || []).filter(u => u !== uuid);
            renderGroups();
            autosave();
        }, { once: true });
    }

    function resolveNamesIn(root) {
        const chips = root.querySelectorAll('.tl-chip[data-uuid]');
        for (const chip of chips) {
            const uuid = chip.getAttribute('data-uuid');
            fromUuid(uuid).then(doc => {
                if (doc?.name) chip.querySelector('.tl-chip-name')?.replaceChildren(document.createTextNode(doc.name));
                const img = chip.querySelector('.tl-chip-img');
                if (img && doc) {
                    const tokenImg = doc.prototypeToken?.texture?.src;
                    img.src = tokenImg || doc.img || '';
                }
            }).catch(() => {});
        }
        const itemRows = root.querySelectorAll('.tl-item-row[data-uuid]');
        for (const row of itemRows) {
            const uuid = row.getAttribute('data-uuid');
            const nameEl = row.querySelector('.tl-item-name');
            const iconEl = row.querySelector('.tl-item-img');
            fromUuid(uuid).then(doc => {
                if (doc?.name && nameEl) nameEl.textContent = doc.name;
                if (iconEl && doc?.img) iconEl.src = doc.img;
            }).catch(() => {});
        }
    }

    // v13-safe folder traversal helpers
    async function collectItemsFromFolder(folder) {
        const out = [];
        const targetId = folder?.id;
        if (!targetId) return out;
        if (folder.pack) {
            const pack = game.packs.get(folder.pack);
            if (pack && pack.documentName === 'Item') {
                const docs = await pack.getDocuments();
                for (const d of docs) if (isFolderOrAncestor(d.folder, targetId)) out.push(d.uuid);
            }
        } else {
            for (const it of game.items) if (isFolderOrAncestor(it.folder, targetId)) out.push(it.uuid);
        }
        return out;
    }

    async function collectActorsFromFolder(folder) {
        const out = [];
        const targetId = folder?.id;
        if (!targetId) return out;
        if (folder.pack) {
            const pack = game.packs.get(folder.pack);
            if (pack && pack.documentName === 'Actor') {
                const docs = await pack.getDocuments();
                for (const d of docs) if (isFolderOrAncestor(d.folder, targetId)) out.push(d.uuid);
            }
        } else if (folder.contents) {
            for (const a of folder.contents) out.push(a.uuid);
        } else {
            for (const a of game.actors) if (isFolderOrAncestor(a.folder, targetId)) out.push(a.uuid);
        }
        return out;
    }

    function isFolderOrAncestor(folderDoc, targetId) {
        let cur = folderDoc;
        while (cur) {
            if (cur.id === targetId) return true;
            cur = cur.folder;
        }
        return false;
    }

    function uniqueGroupId(rules, base) {
        let id = base; let i = 2;
        while (rules.groups[id]) { id = `${base}-${i++}`; }
        return id;
    }

    function shortName(uuid) {
        try { const parts = String(uuid).split('.'); return parts[0] + (parts[1] ? `…${parts[1].slice(-6)}` : ''); } catch { return uuid; }
    }

    // Initial render
    renderGroups();
}

function closeIfOpen() { document.getElementById(OVERLAY_ID)?.remove(); }


