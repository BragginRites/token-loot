'use strict';

import { MODULE_ID, getWorldRuleSet, saveWorldRuleSet, slugify, allActorUuids } from '../utils/settings.js';

const OVERLAY_ID = 'tl-group-manager';

export function openGroupManager() {
	closeIfOpen();
	const state = { rules: structuredClone(getWorldRuleSet()) };
	const overlay = document.createElement('div');
	overlay.id = OVERLAY_ID;
	overlay.innerHTML = template();
	document.body.appendChild(overlay);

	const panel = overlay.querySelector('.tl-panel');
	const dragHandle = overlay.querySelector('#tl-drag');
	makeDraggable(panel, dragHandle);
	makeResizable(panel);
	loadSavedSize(panel);

	const addBtn = overlay.querySelector('#tl-add');
	addBtn.addEventListener('click', () => {
		const baseTitle = 'New Loot Group';
		const id = uniqueGroupId(state.rules, slugify(baseTitle) || 'group');
		state.rules.groups[id] = { id, name: baseTitle, actorUUIDs: [], currency: {}, distributionBlocks: [] };
		renderGroups();
		autosave();
		const input = overlay.querySelector(`.tl-title[data-gid="${id}"]`);
		if (input) { input.focus(); input.select?.(); }
	});

	overlay.querySelector('#tl-close')?.addEventListener('click', () => closeIfOpen());

	function renderGroups() {
		const list = overlay.querySelector('#tl-groups');
		list.innerHTML = '';
		const gids = Object.keys(state.rules.groups);
		if (gids.length === 0) {
			list.innerHTML = `<div class="tl-empty">No groups yet. Click "Add Loot Group".</div>`;
			return;
		}
		for (const gid of gids) list.appendChild(renderGroupCard(state.rules.groups[gid]));
		resolveNamesIn(list);
	}

	function renderGroupCard(group) {
		const el = document.createElement('div');
		el.className = 'tl-card';
		el.innerHTML = `
			<div class="tl-card-hdr">
				<input class="tl-title" data-gid="${group.id}" value="${escapeHtml(group.name || '')}" placeholder="Group Title" />
				<div class="tl-card-actions">
					<button class="tl-btn tl-danger tl-delete">Delete</button>
				</div>
			</div>
			<div class="tl-card-body">
				<div class="tl-sep">Actors</div>
				<div class="tl-drop tl-actors" data-gid="${group.id}">
					${(group.actorUUIDs||[]).map(u => `<div class="tl-chip" data-uuid="${escapeHtml(u)}"><img class="tl-chip-img" src="" alt="" /><span class="tl-chip-name">${shortName(u)}</span><button class="tl-chip-delete" title="Remove Actor">×</button></div>`).join('')}
					${((group.actorUUIDs||[]).length ? '' : '<div class="tl-hint">Drag actors here</div>')}
				</div>
				<div class="tl-sep">Currency</div>
				<div class="tl-currency">
					<div class="tl-currency-row">
						<label>PP</label><input class="tl-currency-input tl-pp" type="text" placeholder="0 or 1d4 or 10-50" value="${escapeHtml(group.currency?.pp || '')}" />
						<label>GP</label><input class="tl-currency-input tl-gp" type="text" placeholder="0 or 2d6*10 or 100-500" value="${escapeHtml(group.currency?.gp || '')}" />
						<label>EP</label><input class="tl-currency-input tl-ep" type="text" placeholder="0 or 1d6 or 5-25" value="${escapeHtml(group.currency?.ep || '')}" />
					</div>
					<div class="tl-currency-row">
						<label>SP</label><input class="tl-currency-input tl-sp" type="text" placeholder="0 or 3d4 or 20-100" value="${escapeHtml(group.currency?.sp || '')}" />
						<label>CP</label><input class="tl-currency-input tl-cp" type="text" placeholder="0 or 5d10 or 50-200" value="${escapeHtml(group.currency?.cp || '')}" />
						<span class="tl-currency-spacer"></span>
					</div>
				</div>
				<div class="tl-sep">Distribution Blocks</div>
				<div class="tl-distribution-blocks">
					${(group.distributionBlocks||[]).map(block => `
						<div class="tl-distribution-block" data-block-id="${block.id}">
							<div class="tl-distribution-header">
								<input class="tl-block-name" value="${escapeHtml(block.name || '')}" placeholder="Block Name" />
								<div class="tl-distribution-buttons">
									<button class="tl-btn tl-distribution-btn ${(block.type || 'all') === 'all' ? 'tl-active' : ''}" data-type="all">All</button>
									<button class="tl-btn tl-distribution-btn ${(block.type || 'all') === 'pick' ? 'tl-active' : ''}" data-type="pick">Pick N</button>
									<button class="tl-btn tl-distribution-btn ${(block.type || 'all') === 'chance' ? 'tl-active' : ''}" data-type="chance">Chances</button>
								</div>
								<button class="tl-btn tl-danger tl-icon tl-remove-block" title="Remove Block"><i class="fas fa-trash"></i></button>
							</div>
							<div class="tl-distribution-config">
								${(block.type === 'pick') ? `
									<label>Pick</label><input class="tl-num tl-distribution-count" type="number" min="1" value="${Number(block.count || 1)}" />
									<label>items</label>
									<label class="tl-spacer"></label>
									<label><input class="tl-block-duplicates" type="checkbox" ${block.allowDuplicates?'checked':''}/> Allow duplicates</label>
								` : ''}
							</div>
							<div class="tl-drop tl-items tl-items-list" data-block-id="${block.id}">
								${(block.items||[]).map(r => `<div class="tl-row tl-item" data-uuid="${escapeHtml(r.uuid)}">
									<div class="tl-item-cell"><img class="tl-item-icon" src="" alt="" /><div class="tl-item-name">${shortName(r.uuid)}</div></div>
									<span class="tl-grid-spacer"></span>
									${(block.type === 'chance') ? `<label>Chance</label><input class="tl-num tl-chance" type="number" min="0" max="100" step="1" value="${Number((r.chance ?? 100))}" />` : '<span></span><span></span>'}
									<label>Qty</label><input class="tl-num tl-qmin" type="number" min="1" value="${Number(r.qtyMin ?? 1)}" /> <span class="tl-dash">–</span> <input class="tl-num tl-qmax" type="number" min="1" value="${Number(r.qtyMax ?? 1)}" />
									<button class="tl-btn tl-icon tl-remove" title="Remove"><i class="fas fa-trash"></i></button>
								</div>`).join('')}
								${((block.items||[]).length ? '' : '<div class="tl-hint">Drag items here</div>')}
							</div>
						</div>
					`).join('')}
					${((group.distributionBlocks||[]).length ? '' : '<div class="tl-empty">No distribution blocks yet.</div>')}
					<button class="tl-btn tl-add-block">Add Distribution Block</button>
				</div>
			</div>
		`;

		// listeners
		el.querySelector('.tl-title').addEventListener('input', ev => { group.name = ev.currentTarget.value; autosaveDeferred(); });
		
		// Currency inputs
		['pp', 'gp', 'ep', 'sp', 'cp'].forEach(curr => {
			el.querySelector(`.tl-${curr}`)?.addEventListener('input', ev => {
				if (!group.currency) group.currency = {};
				group.currency[curr] = ev.currentTarget.value.trim() || '';
				autosaveDeferred();
			});
		});
		
		// Add distribution block
		el.querySelector('.tl-add-block')?.addEventListener('click', () => {
			if (!group.distributionBlocks) group.distributionBlocks = [];
			const blockId = `block-${Date.now()}`;
			group.distributionBlocks.push({
				id: blockId,
				name: 'New Block',
				type: 'all',
				count: 1,
				allowDuplicates: false,
				items: []
			});
			renderGroups();
			autosave();
		});
		
		// Distribution block listeners
		el.querySelectorAll('.tl-distribution-block').forEach(blockEl => {
			const blockId = blockEl.getAttribute('data-block-id');
			const block = (group.distributionBlocks||[]).find(b => b.id === blockId);
			if (!block) return;
			
			// Block name
			blockEl.querySelector('.tl-block-name')?.addEventListener('input', ev => {
				block.name = ev.currentTarget.value;
				autosaveDeferred();
			});
			
			// Block type buttons
			blockEl.querySelectorAll('.tl-distribution-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const type = btn.getAttribute('data-type');
					block.type = type;
					renderGroups();
					autosave();
				});
			});
			
			// Block settings
			blockEl.querySelector('.tl-distribution-count')?.addEventListener('change', ev => {
				block.count = Number(ev.currentTarget.value||1);
				autosaveDeferred();
			});
			blockEl.querySelector('.tl-block-duplicates')?.addEventListener('change', ev => {
				block.allowDuplicates = !!ev.currentTarget.checked;
				autosaveDeferred();
			});
			
			// Remove block
			blockEl.querySelector('.tl-remove-block')?.addEventListener('click', async (ev) => {
				const skipConfirm = ev.shiftKey;
				const ok = await confirmDialog('Remove Block?', `Remove "${block.name}" distribution block?`, skipConfirm);
				if (!ok) return;
				group.distributionBlocks = (group.distributionBlocks||[]).filter(b => b.id !== blockId);
				renderGroups();
				autosave();
			});
		});
		el.querySelector('.tl-delete').addEventListener('click', async (ev) => {
			try {
				const skipConfirm = ev.shiftKey;
				const ok = await confirmDialog('Delete Loot Group?', `Are you sure you want to delete "${group.name || group.id}"?`, skipConfirm);
				if (!ok) return;
				delete state.rules.groups[group.id];
				renderGroups();
				autosave();
			} catch {}
		});

		const body = el.querySelector('.tl-card-body');
		const hdr = el.querySelector('.tl-card-hdr');
		function toggleCollapse() {
			const collapsed = el.classList.toggle('collapsed');
			if (body) body.style.display = collapsed ? 'none' : '';
		}
		hdr?.addEventListener('click', ev => { if (ev.target.closest('input, .tl-card-actions')) return; toggleCollapse(); });

		const actorsDrop = el.querySelector('.tl-actors');
		const itemsDrop = el.querySelector('.tl-items');
		enableDroppable(actorsDrop, async data => {
			if (data.type !== 'Actor' || !data.uuid) return;
			// Enforce unique membership
			const all = allActorUuids(state.rules);
			if (all.has(data.uuid)) return ui.notifications?.warn('Actor is already in another group.');
			group.actorUUIDs = group.actorUUIDs || [];
			group.actorUUIDs.push(data.uuid);
			renderGroups();
			autosave();
		});
		// Enable dropping items and folders on distribution blocks
		el.querySelectorAll('.tl-distribution-block .tl-items-list').forEach(itemsDrop => {
			enableDroppable(itemsDrop, async data => {
				const blockId = itemsDrop.getAttribute('data-block-id');
				const block = (group.distributionBlocks||[]).find(b => b.id === blockId);
				if (!block) return;
				
				if (data.type === 'Item' && data.uuid) {
					// Single item drop
					block.items = block.items || [];
					block.items.push({ uuid: data.uuid, chance: 100, qtyMin: 1, qtyMax: 1 });
					renderGroups();
					autosave();
				} else if (data.type === 'Folder' && data.uuid) {
					// Folder drop
					await handleFolderDrop(data, block);
				}
			});
		});

		// item row events delegation
		el.addEventListener('change', ev => {
			const row = ev.target.closest('.tl-item');
			if (!row) return;
			const uuid = row.getAttribute('data-uuid');
			const blockEl = ev.target.closest('.tl-distribution-block');
			if (!blockEl) return;
			const blockId = blockEl.getAttribute('data-block-id');
			const block = (group.distributionBlocks||[]).find(b => b.id === blockId);
			if (!block) return;
			const entry = (block.items||[]).find(r => r.uuid === uuid);
			if (!entry) return;
			if (ev.target.classList.contains('tl-chance')) entry.chance = clamp(Number(ev.target.value||0), 0, 100);
			if (ev.target.classList.contains('tl-qmin')) entry.qtyMin = Math.max(1, Number(ev.target.value||1));
			if (ev.target.classList.contains('tl-qmax')) entry.qtyMax = Math.max(1, Number(ev.target.value||1));
			autosaveDeferred();
		});
		el.addEventListener('click', async ev => {
			const btn = ev.target.closest('.tl-remove');
			if (btn) {
				const row = ev.target.closest('.tl-item');
				const uuid = row.getAttribute('data-uuid');
				const blockEl = ev.target.closest('.tl-distribution-block');
				if (!blockEl) return;
				const blockId = blockEl.getAttribute('data-block-id');
				const block = (group.distributionBlocks||[]).find(b => b.id === blockId);
				if (!block) return;
				const itemName = row.querySelector('.tl-item-name')?.textContent || 'this item';
				const skipConfirm = ev.shiftKey;
				const ok = await confirmDialog('Remove Item?', `Remove "${itemName}" from "${block.name}"?`, skipConfirm);
				if (!ok) return;
				block.items = (block.items||[]).filter(r => r.uuid !== uuid);
				renderGroups();
				autosave();
				return;
			}
			
			const chipDelete = ev.target.closest('.tl-chip-delete');
			if (chipDelete) {
				const chip = ev.target.closest('.tl-chip');
				const uuid = chip.getAttribute('data-uuid');
				const actorName = chip.querySelector('.tl-chip-name')?.textContent || 'this actor';
				const skipConfirm = ev.shiftKey;
				const ok = await confirmDialog('Remove Actor?', `Remove "${actorName}" from this group?`, skipConfirm);
				if (!ok) return;
				group.actorUUIDs = (group.actorUUIDs||[]).filter(u => u !== uuid);
				renderGroups();
				autosave();
			}
		});

		return el;
	}

	function autosave() {
		saveWorldRuleSet(state.rules);
	}
	let saveTimer = null;
	function autosaveDeferred() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => autosave(), 400);
	}

	renderGroups();

	function resolveNamesIn(root) {
		const chips = root.querySelectorAll('.tl-chip[data-uuid]');
		for (const chip of chips) {
			const uuid = chip.getAttribute('data-uuid');
			fromUuid(uuid).then(doc => {
				if (doc?.name) chip.querySelector('.tl-chip-name')?.replaceChildren(document.createTextNode(doc.name));
				const img = chip.querySelector('.tl-chip-img');
				if (img && doc?.img) img.src = doc.img;
			}).catch(() => {});
		}
		const itemRows = root.querySelectorAll('.tl-item[data-uuid]');
		for (const row of itemRows) {
			const uuid = row.getAttribute('data-uuid');
			const nameEl = row.querySelector('.tl-item-name');
			const iconEl = row.querySelector('.tl-item-icon');
			fromUuid(uuid).then(doc => {
				if (doc?.name && nameEl) nameEl.textContent = doc.name;
				if (iconEl && doc?.img) iconEl.src = doc.img;
			}).catch(() => {});
		}
	}

	async function handleFolderDrop(data, block) {
		try {
			const folder = await fromUuid(data.uuid);
			if (!folder) return;
			
			const items = await collectItemsFromFolder(folder);
			if (items.length === 0) {
				ui.notifications?.warn(`No items found in folder "${folder.name}"`);
				return;
			}

			const settings = await showBatchSettingsDialog(folder.name, items.length);
			if (!settings) return; // User cancelled

			block.items = block.items || [];
			for (const itemUuid of items) {
				block.items.push({
					uuid: itemUuid,
					chance: settings.chance,
					qtyMin: settings.qtyMin,
					qtyMax: settings.qtyMax
				});
			}

			renderGroups();
			autosave();
			ui.notifications?.info(`Added ${items.length} items from "${folder.name}" to "${block.name}"`);
		} catch (error) {
			console.error(`${MODULE_ID} | Error handling folder drop:`, error);
			ui.notifications?.error(`Failed to add items from folder: ${error.message}`);
		}
	}

	async function collectItemsFromFolder(folder) {
		const items = [];
		
		// Handle compendium folders
		if (folder.pack) {
			const pack = game.packs.get(folder.pack);
			if (pack && pack.documentName === 'Item') {
				const documents = await pack.getDocuments();
				for (const doc of documents) {
					if (doc.folder?.id === folder.id || (!doc.folder && folder.name === pack.metadata.label)) {
						items.push(doc.uuid);
					}
				}
			}
		}
		// Handle world folders
		else if (folder.contents) {
			for (const item of folder.contents) {
				if (item.documentName === 'Item') {
					items.push(item.uuid);
				}
			}
		}
		// Alternative approach for world folders using game.items
		else {
			for (const item of game.items) {
				if (item.folder?.id === folder.id) {
					items.push(item.uuid);
				}
			}
		}
		
		// Recursively collect from subfolders
		if (folder.children) {
			for (const childFolder of folder.children) {
				const childItems = await collectItemsFromFolder(childFolder);
				items.push(...childItems);
			}
		}
		
		return items;
	}

	function showBatchSettingsDialog(folderName, itemCount) {
		return new Promise(resolve => {
			const overlay = document.createElement('div');
			overlay.className = 'tl-confirm-overlay';
			overlay.innerHTML = `
				<div class="tl-confirm-dialog" style="min-width: 420px;">
					<div class="tl-confirm-header">Add Items from Folder</div>
					<div class="tl-confirm-body">
						<p>Adding <strong>${itemCount}</strong> items from "<strong>${escapeHtml(folderName)}</strong>" folder</p>
						<div style="margin-top: 16px;">
							<div style="display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center;">
								<label>Chance:</label><input id="batch-chance" type="number" min="0" max="100" value="100" style="padding: 6px 8px; border: 1px solid #2a2f3a; border-radius: 8px; background: #121723; color: #d6dbea;" />
								<label>Quantity:</label><div style="display: flex; gap: 8px; align-items: center;">
									<input id="batch-qmin" type="number" min="1" value="1" style="width: 60px; padding: 6px 8px; border: 1px solid #2a2f3a; border-radius: 8px; background: #121723; color: #d6dbea;" />
									<span style="opacity: 0.6;">to</span>
									<input id="batch-qmax" type="number" min="1" value="1" style="width: 60px; padding: 6px 8px; border: 1px solid #2a2f3a; border-radius: 8px; background: #121723; color: #d6dbea;" />
								</div>
							</div>
						</div>
					</div>
					<div class="tl-confirm-actions">
						<button class="tl-confirm-btn tl-confirm-cancel">Cancel</button>
						<button class="tl-confirm-btn tl-confirm-ok" style="background: #2a4a2a; border-color: #3a5a3a;">Add Items</button>
					</div>
				</div>
				<style>
				.tl-confirm-overlay{position:fixed;inset:0;z-index:100000;background:transparent;display:flex;align-items:center;justify-content:center}
				.tl-confirm-dialog{background:#0f1218;color:#e8ecf1;border:1px solid #2a2f3a;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.8);min-width:320px;max-width:480px}
				.tl-confirm-header{padding:12px 16px;font-weight:800;font-size:16px;border-bottom:1px solid #2a2f3a;background:linear-gradient(180deg,#141824,#10141e)}
				.tl-confirm-body{padding:16px;line-height:1.4}
				.tl-confirm-actions{padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #2a2f3a}
				.tl-confirm-btn{appearance:none;border:1px solid #2a2f3a;background:#161b28;color:#efece6;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:700}
				.tl-confirm-btn:hover{filter:brightness(1.06)}
				</style>
			`;
			
			document.body.appendChild(overlay);
			
			const handleResult = (result) => {
				overlay.remove();
				resolve(result);
			};
			
			overlay.querySelector('.tl-confirm-ok').addEventListener('click', () => {
				const chance = Number(overlay.querySelector('#batch-chance').value) || 100;
				const qtyMin = Number(overlay.querySelector('#batch-qmin').value) || 1;
				const qtyMax = Number(overlay.querySelector('#batch-qmax').value) || 1;
				handleResult({ chance, qtyMin, qtyMax });
			});
			
			overlay.querySelector('.tl-confirm-cancel').addEventListener('click', () => handleResult(null));
			overlay.addEventListener('click', ev => { if (ev.target === overlay) handleResult(null); });
			
			// Focus the chance input
			overlay.querySelector('#batch-chance').focus();
		});
	}
}

function closeIfOpen() {
	document.getElementById(OVERLAY_ID)?.remove();
}

function template() {
	return `
<style>
#${OVERLAY_ID}{position:fixed;inset:0;z-index:99999;pointer-events:none}
#${OVERLAY_ID} *{box-sizing:border-box}
#${OVERLAY_ID} .tl-panel{pointer-events:auto;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#0f1218;color:#e8ecf1;border:1px solid #2a2f3a;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);min-width:640px;min-height:400px;max-width:95vw;max-height:95vh;display:flex;flex-direction:column;resize:both;overflow:auto}
#${OVERLAY_ID} .tl-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:linear-gradient(180deg,#141824,#10141e);border-bottom:1px solid #2a2f3a;cursor:move}
#${OVERLAY_ID} .tl-title{font-weight:800;font-size:14px;letter-spacing:.3px;background:transparent;border:none;color:#e8ecf1;width:50%}
#${OVERLAY_ID} .tl-close{appearance:none;border:none;width:28px;height:28px;border-radius:8px;background:#171b27;color:#c6ccda;cursor:pointer}
#${OVERLAY_ID} .tl-close:hover{background:#1d2331}
#${OVERLAY_ID} .tl-body{padding:12px;overflow:auto;display:grid;gap:12px}
#${OVERLAY_ID} .tl-actions{display:flex;gap:8px}
#${OVERLAY_ID} .tl-btn{appearance:none;border:1px solid #2a2f3a;background:#161b28;color:#efece6;padding:8px 10px;border-radius:8px;cursor:pointer;text-align:center;font-weight:700}
#${OVERLAY_ID} .tl-btn:hover{filter:brightness(1.06)}
#${OVERLAY_ID} .tl-danger{background:#2a1717;border-color:#3a2626}
#${OVERLAY_ID} .tl-sep{margin:10px 0 6px;font-weight:800;color:#cfd6e4;border-top:1px solid #2a2f3a;padding-top:8px}
#${OVERLAY_ID} .tl-empty{opacity:.7;padding:12px;border:1px dashed #2a2f3a;border-radius:8px;text-align:center}
#${OVERLAY_ID} .tl-card{border:1px solid #2a2f3a;border-radius:10px;background:#10141e}
#${OVERLAY_ID} .tl-card-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #2a2f3a}
#${OVERLAY_ID} .tl-card.collapsed .tl-card-hdr{border-bottom:none}
#${OVERLAY_ID} .tl-card-body{display:block}
#${OVERLAY_ID} .tl-card.collapsed .tl-card-body{display:none}
#${OVERLAY_ID} .tl-card-actions{display:flex;gap:8px}
#${OVERLAY_ID} .tl-row{display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr;gap:8px;align-items:center;padding:8px 12px}
#${OVERLAY_ID} .tl-meta{grid-template-columns:auto 80px auto 80px 1fr auto}
#${OVERLAY_ID} .tl-num{width:64px;min-width:64px;max-width:64px;padding:6px 8px;border:1px solid #2a2f3a;border-radius:8px;background:#121723;color:#d6dbea;text-align:right}
#${OVERLAY_ID} .tl-spacer{flex:1}
#${OVERLAY_ID} .tl-drop{padding:10px;border:1px dashed #2a2f3a;border-radius:8px;min-height:56px;display:flex;flex-wrap:wrap;gap:6px}
#${OVERLAY_ID} .tl-items-list{display:block}
#${OVERLAY_ID} .tl-drop.drag{outline:2px solid #4b81ff}
#${OVERLAY_ID} .tl-chip{background:#141a27;border:1px solid #2a2f3a;padding:4px 8px;border-radius:999px}
#${OVERLAY_ID} .tl-chip{display:flex;align-items:center;gap:6px;position:relative}
#${OVERLAY_ID} .tl-chip-delete{display:none;position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#2a1717;border:1px solid #3a2626;color:#ff6b6b;font-size:12px;line-height:1;cursor:pointer;appearance:none;padding:0}
#${OVERLAY_ID} .tl-chip:hover .tl-chip-delete{display:flex;align-items:center;justify-content:center}
#${OVERLAY_ID} .tl-chip-img{width:42px;height:42px;border-radius:6px;object-fit:cover}
#${OVERLAY_ID} .tl-item{grid-template-columns:auto 1fr 1fr auto 64px auto 64px auto 64px auto;gap:10px;align-items:center}
#${OVERLAY_ID} .tl-grid-spacer{grid-column:3/4}
#${OVERLAY_ID} .tl-item-cell{display:flex;align-items:center;gap:10px;min-width:0}
#${OVERLAY_ID} .tl-item-icon{width:42px;height:42px;border-radius:6px;object-fit:cover}
#${OVERLAY_ID} .tl-item-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${OVERLAY_ID} .tl-switch{display:flex;align-items:center;gap:6px}
#${OVERLAY_ID} .tl-icon{appearance:none;border:1px solid #3a2626;background:#2a1717;color:#e8ecf1;padding:6px 8px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
#${OVERLAY_ID} .tl-icon .fa-trash{color:#ff6b6b}
#${OVERLAY_ID} .tl-dash{opacity:.6}
#${OVERLAY_ID} .tl-distribution{padding:8px 12px}
#${OVERLAY_ID} .tl-distribution-buttons{display:flex;gap:8px;margin-bottom:8px}
#${OVERLAY_ID} .tl-distribution-btn{font-size:12px;padding:6px 10px}
#${OVERLAY_ID} .tl-distribution-btn.tl-active{background:#2a4a2a;border-color:#3a5a3a}
#${OVERLAY_ID} .tl-distribution-config{display:grid;grid-template-columns:auto 80px auto 1fr auto;gap:8px;align-items:center}
#${OVERLAY_ID} .tl-distribution-blocks{padding:8px 12px}
#${OVERLAY_ID} .tl-distribution-block{border:1px solid #2a2f3a;border-radius:8px;margin-bottom:12px;background:#0a0e14}
#${OVERLAY_ID} .tl-distribution-header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #2a2f3a}
#${OVERLAY_ID} .tl-block-name{flex:1;padding:6px 8px;border:1px solid #2a2f3a;border-radius:8px;background:#121723;color:#d6dbea;font-weight:600}
#${OVERLAY_ID} .tl-currency{padding:8px 12px}
#${OVERLAY_ID} .tl-currency-row{display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr;gap:8px;align-items:center;margin-bottom:8px}
#${OVERLAY_ID} .tl-currency-row:last-child{margin-bottom:0}
#${OVERLAY_ID} .tl-currency-input{padding:6px 8px;border:1px solid #2a2f3a;border-radius:8px;background:#121723;color:#d6dbea;font-size:12px}
#${OVERLAY_ID} .tl-currency-spacer{grid-column:span 2}
</style>
<div class="tl-panel" role="dialog" aria-label="Loot Group Manager">
	<div class="tl-hdr" id="tl-drag">
		<div class="tl-title">Loot Group Manager</div>
		<div class="tl-actions">
			<button class="tl-btn" id="tl-add">Add Loot Group</button>
			<button class="tl-close" id="tl-close">×</button>
		</div>
	</div>
	<div class="tl-body">
		<div id="tl-groups"></div>
	</div>
</div>
`;
}

function enableDroppable(el, onDrop) {
	el.addEventListener('dragover', ev => { ev.preventDefault(); el.classList.add('drag'); });
	el.addEventListener('dragleave', () => el.classList.remove('drag'));
	el.addEventListener('drop', async ev => {
		ev.preventDefault(); el.classList.remove('drag');
		const data = parseDrop(ev);
		if (data) await onDrop(data);
	});
}

function parseDrop(ev) {
	try {
		const txt = ev.dataTransfer?.getData('text/plain');
		if (!txt) return null;
		const data = JSON.parse(txt);
		return data;
	} catch { return null; }
}

function promptAsync(label) {
	return new Promise(resolve => {
		new Dialog({
			title: label,
			content: `<input type="text" name="name" style="width:100%" autofocus />`,
			buttons: {
				ok: { label: 'OK', callback: html => resolve(html[0].querySelector('input').value?.trim()) },
				cancel: { label: 'Cancel', callback: () => resolve(null) }
			},
			default: 'ok'
		}).render(true);
	});
}

function uniqueGroupId(rules, base) {
	let id = base; let i = 2;
	while (rules.groups[id]) { id = `${base}-${i++}`; }
	return id;
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

function shortName(uuid) {
	try {
		const parts = String(uuid).split('.');
		return parts[0] + (parts[1] ? `…${parts[1].slice(-6)}` : '');
	} catch { return uuid; }
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function makeDraggable(panel, handle) {
	let sx=0, sy=0, ox=0, oy=0, dragging=false;
	panel.style.position='fixed'; panel.style.left='50%'; panel.style.top='50%'; panel.style.transform='translate(-50%,-50%)';
	function start(e){ dragging=true; const p=(e.touches&&e.touches[0])||e; sx=p.clientX; sy=p.clientY; const r=panel.getBoundingClientRect(); ox=r.left; oy=r.top;
		document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
		document.addEventListener('touchmove', move, {passive:false}); document.addEventListener('touchend', end); }
	function move(e){ if(!dragging) return; const p=(e.touches&&e.touches[0])||e; panel.style.left=(ox+p.clientX-sx)+'px'; panel.style.top=(oy+p.clientY-sy)+'px'; panel.style.transform='translate(0,0)'; if (e.cancelable) e.preventDefault(); }
	function end(){ dragging=false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', end); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); }
	handle.addEventListener('mousedown', start); handle.addEventListener('touchstart', start, {passive:true});
}

function makeResizable(panel) {
	const resizeObserver = new ResizeObserver(() => saveSize(panel));
	resizeObserver.observe(panel);
	panel.addEventListener('mouseup', () => saveSize(panel));
	panel.addEventListener('touchend', () => saveSize(panel));
}

function saveSize(panel) {
	try {
		const r = panel.getBoundingClientRect();
		const size = { width: Math.round(r.width), height: Math.round(r.height) };
		const existing = game.settings.get(MODULE_ID, 'groupManagerSize') || {};
		if (existing.width === size.width && existing.height === size.height) return;
		game.settings.set(MODULE_ID, 'groupManagerSize', size);
	} catch {}
}

function loadSavedSize(panel) {
	try {
		const sz = game.settings.get(MODULE_ID, 'groupManagerSize') || {};
		if (sz.width) panel.style.width = sz.width + 'px';
		if (sz.height) panel.style.height = sz.height + 'px';
	} catch {}
}

function confirmDialog(title, message, skipConfirm = false) {
	return new Promise(resolve => {
		// Skip confirmation if requested (e.g., when Shift key is held)
		if (skipConfirm) {
			resolve(true);
			return;
		}
		
		const overlay = document.createElement('div');
		overlay.className = 'tl-confirm-overlay';
		overlay.innerHTML = `
			<div class="tl-confirm-dialog">
				<div class="tl-confirm-header">${escapeHtml(title)}</div>
				<div class="tl-confirm-body">${escapeHtml(message)}</div>
				<div class="tl-confirm-actions">
					<button class="tl-confirm-btn tl-confirm-cancel">Cancel</button>
					<button class="tl-confirm-btn tl-confirm-ok tl-danger">Delete</button>
				</div>
			</div>
			<style>
			.tl-confirm-overlay{position:fixed;inset:0;z-index:100000;background:transparent;display:flex;align-items:center;justify-content:center}
			.tl-confirm-dialog{background:#0f1218;color:#e8ecf1;border:1px solid #2a2f3a;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.8);min-width:320px;max-width:480px}
			.tl-confirm-header{padding:12px 16px;font-weight:800;font-size:16px;border-bottom:1px solid #2a2f3a;background:linear-gradient(180deg,#141824,#10141e)}
			.tl-confirm-body{padding:16px;line-height:1.4}
			.tl-confirm-actions{padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #2a2f3a}
			.tl-confirm-btn{appearance:none;border:1px solid #2a2f3a;background:#161b28;color:#efece6;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:700}
			.tl-confirm-btn:hover{filter:brightness(1.06)}
			.tl-confirm-btn.tl-danger{background:#2a1717;border-color:#3a2626}
			</style>
		`;
		
		document.body.appendChild(overlay);
		
		const handleClick = (result) => {
			overlay.remove();
			resolve(result);
		};
		
		overlay.querySelector('.tl-confirm-ok').addEventListener('click', () => handleClick(true));
		overlay.querySelector('.tl-confirm-cancel').addEventListener('click', () => handleClick(false));
		overlay.addEventListener('click', ev => { if (ev.target === overlay) handleClick(false); });
		
		// Focus the cancel button by default
		overlay.querySelector('.tl-confirm-cancel').focus();
	});
}


