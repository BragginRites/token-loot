'use strict';

import { MODULE_ID, getWorldRuleSet, saveWorldRuleSet, slugify, allActorUuids } from '../../utils/settings.js';
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
                    const all = allActorUuids(state.rules);
                    if (all.has(data.uuid)) return ui.notifications?.warn('Actor is already in another group.');
                    group.actorUUIDs = group.actorUUIDs || [];
                    group.actorUUIDs.push(data.uuid);
                    await renderGroups();
                    autosave();
                }
            });
            await renderActorChips(actorsEl, group.actorUUIDs || []);

            // Blocks
            const blocksEl = card.querySelector('.tl-distribution-blocks');
            for (const block of (group.distributionBlocks || [])) {
                const blockEl = await renderDistributionBlock(block);
                blocksEl.appendChild(blockEl);
                // Items list
                const itemsRoot = blockEl.querySelector('.tl-items');
                for (const row of (block.items || [])) {
                    const rowData = { ...row, showChance: block.type === 'chance' };
                    itemsRoot.appendChild(await renderItemRow(rowData));
                }
                enableDroppable(itemsRoot, async data => {
                    if (data.type === 'Item' && data.uuid) {
                        block.items = block.items || [];
                        block.items.push({ uuid: data.uuid, chance: 100, qtyMin: 1, qtyMax: 1 });
                        await renderGroups();
                        autosave();
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
            // Add block button
            const addBlockBtn = document.createElement('button');
            addBlockBtn.className = 'tl-btn tl-add-block';
            addBlockBtn.textContent = 'Add Distribution Block';
            addBlockBtn.addEventListener('click', () => {
                group.distributionBlocks = group.distributionBlocks || [];
                const blockId = `block-${Date.now()}`;
                group.distributionBlocks.push({ id: blockId, name: 'New Block', type: 'all', count: 1, allowDuplicates: false, items: [] });
                renderGroups();
                autosave();
            });
            blocksEl.appendChild(addBlockBtn);

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
            hint.textContent = 'Drag actors here';
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


