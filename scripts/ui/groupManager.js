'use strict';

import { MODULE_ID, getWorldRuleSet, saveWorldRuleSet, slugify, allActorUuids } from '../utils/settings.js';
import { openBlockContextMenu as openBlockContextMenuComponent } from './groupManager/components/ContextMenu.js';
import { makeDraggable as attachDrag, makeResizable as attachResize, loadSavedSize as loadSavedPanelSize, saveSize as persistSize } from './groupManager/services/ResizeManager.js';
import { enableDroppable as enableDroppableService, parseDrop as parseDropService } from './groupManager/services/DragDropManager.js';
import { confirmDialog as confirmDialogComponent } from './groupManager/dialogs/ConfirmDialog.js';
import { showBatchSettingsDialog as batchDialogComponent } from './groupManager/dialogs/BatchItemDialog.js';

const OVERLAY_ID = 'tl-group-manager';

export function openGroupManager() {
	closeIfOpen();
	const state = { rules: structuredClone(getWorldRuleSet()) };
	const collapsedBlocks = new Set();
	let copiedBlock = null; // in-memory clipboard for distribution blocks
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
							<div class="tl-distribution-config" style="display:${collapsedBlocks.has(block.id)?'none':''}">
								${(block.type === 'pick') ? `
									<label>Pick</label><input class="tl-num tl-distribution-count" type="number" min="1" value="${Number(block.count || 1)}" />
									<label>items</label>
									<label class="tl-spacer"></label>
									<label><input class="tl-block-duplicates" type="checkbox" ${block.allowDuplicates?'checked':''}/> Allow duplicates</label>
								` : (block.type === 'chance') ? `
									<label>Min</label><input class="tl-num tl-ch-min" type="number" min="0" value="${Number(block.chanceMin ?? 1)}" />
									<label>Max</label><input class="tl-num tl-ch-max" type="number" min="0" value="${Number(block.chanceMax ?? 1)}" />
									<label class="tl-spacer"></label>
									<label><input class="tl-block-duplicates" type="checkbox" ${block.allowDuplicates?'checked':''}/> Allow duplicates</label>
								` : ''}
							</div>
							<div class="tl-drop tl-items tl-items-list" data-block-id="${block.id}" style="display:${collapsedBlocks.has(block.id)?'none':''}">
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

			// Make distribution block collapsible by clicking the header (but not when interacting with inputs/buttons)
			const header = blockEl.querySelector('.tl-distribution-header');
			const config = blockEl.querySelector('.tl-distribution-config');
			const itemsList = blockEl.querySelector('.tl-items-list');
			header?.addEventListener('click', ev => {
				if (ev.target.closest('input,button,.tl-distribution-buttons,.tl-remove-block')) return;
				const collapsed = blockEl.classList.toggle('tl-collapsed');
				if (config) config.style.display = collapsed ? 'none' : '';
				if (itemsList) itemsList.style.display = collapsed ? 'none' : '';
				if (collapsed) collapsedBlocks.add(blockId); else collapsedBlocks.delete(blockId);
			});

			// Context menu for copy/paste
			header?.addEventListener('contextmenu', ev => {
				ev.preventDefault();
				ev.stopPropagation();
				ev.stopImmediatePropagation?.();
				openBlockContextMenu(ev.clientX, ev.clientY, {
					onCopy: () => {
						copiedBlock = foundry.utils.deepClone(block);
						ui.notifications?.info('Block copied');
					},
					onPaste: () => {
						if (!copiedBlock) return ui.notifications?.warn('Nothing to paste');
						const src = foundry.utils.deepClone(copiedBlock);
						// Overwrite target block's properties but keep its id
						block.name = src.name || block.name;
						block.type = src.type || 'all';
						block.count = Number(src.count || 1);
						block.allowDuplicates = !!src.allowDuplicates;
						block.items = Array.isArray(src.items) ? src.items.map(r => ({ ...r })) : [];
						renderGroups();
						autosave();
						ui.notifications?.info('Block pasted over current block');
					}
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
			// Chance min/max
			blockEl.querySelector('.tl-ch-min')?.addEventListener('change', ev => {
				block.chanceMin = Math.max(0, Number(ev.currentTarget.value||0));
				autosaveDeferred();
			});
			blockEl.querySelector('.tl-ch-max')?.addEventListener('change', ev => {
				block.chanceMax = Math.max(0, Number(ev.currentTarget.value||0));
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
			if (data.type === 'Actor' && data.uuid) {
				// Handle single actor drop
				const all = allActorUuids(state.rules);
				if (all.has(data.uuid)) return ui.notifications?.warn('Actor is already in another group.');
				group.actorUUIDs = group.actorUUIDs || [];
				group.actorUUIDs.push(data.uuid);
				renderGroups();
				autosave();
			} else if (data.type === 'Folder' && data.uuid) {
				// Handle folder drop
				await handleActorFolderDrop(data, group);
			}
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
				if (img && doc) {
					// Use token image if available, fallback to portrait
					const tokenImg = doc.prototypeToken?.texture?.src;
					img.src = tokenImg || doc.img || '';
				}
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
				// Store a sortable name and resort this list on every resolution
				if (doc?.name) row.dataset.sortName = String(doc.name).toLowerCase();
				const listEl = row.closest('.tl-items-list');
				if (listEl) sortItemsContainer(listEl);
			}).catch(() => {});
		}
	}

	function sortItemsContainer(listEl) {
		try {
			const rows = Array.from(listEl.querySelectorAll(':scope > .tl-item'));
			rows.sort((a, b) => {
				const an = a.dataset.sortName || a.querySelector('.tl-item-name')?.textContent?.toLowerCase() || '';
				const bn = b.dataset.sortName || b.querySelector('.tl-item-name')?.textContent?.toLowerCase() || '';
				return an.localeCompare(bn, undefined, { sensitivity: 'base' });
			});
			for (const r of rows) listEl.appendChild(r);
		} catch {}
	}

	async function handleFolderDrop(data, block) {
		try {
			console.log(`${MODULE_ID} | handleFolderDrop - data:`, data);
			const folder = await fromUuid(data.uuid);
			console.log(`${MODULE_ID} | handleFolderDrop - resolved folder:`, folder);
			if (!folder) return;
			
			const items = await collectItemsFromFolder(folder);
			console.log(`${MODULE_ID} | handleFolderDrop - collected items:`, items);
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
		console.log(`${MODULE_ID} | collectItemsFromFolder - folder:`, folder);
		console.log(`${MODULE_ID} | collectItemsFromFolder - folder.pack:`, folder.pack);
		console.log(`${MODULE_ID} | collectItemsFromFolder - folder.contents:`, folder.contents);
		
		const items = [];
		
		// New robust approach for v13: walk folder ancestry on each item
		const targetFolderId = folder.id;
		// Compendium pack branch
		if (folder.pack) {
			console.log(`${MODULE_ID} | collectItemsFromFolder - processing compendium folder`);
			const pack = game.packs.get(folder.pack);
			console.log(`${MODULE_ID} | collectItemsFromFolder - pack:`, pack);
			if (pack && pack.documentName === 'Item') {
				console.log(`${MODULE_ID} | collectItemsFromFolder - getting documents from pack`);
				const documents = await pack.getDocuments();
				console.log(`${MODULE_ID} | collectItemsFromFolder - pack documents:`, documents.length);
				for (const doc of documents) {
					const inScope = isFolderOrAncestor(doc.folder, targetFolderId);
					if (inScope) {
						console.log(`${MODULE_ID} | collectItemsFromFolder - adding item from compendium:`, doc.name, doc.uuid);
						items.push(doc.uuid);
					}
				}
			}
		}
		// World branch
		else {
			console.log(`${MODULE_ID} | collectItemsFromFolder - processing world folder`);
			// Prefer scanning game.items to include nested folders via ancestry walk
			for (const item of game.items) {
				const inScope = isFolderOrAncestor(item.folder, targetFolderId);
				if (inScope) {
					console.log(`${MODULE_ID} | collectItemsFromFolder - adding world item:`, item.name, item.uuid);
					items.push(item.uuid);
				}
			}
		}
		
		// Using ancestry walk; no explicit recursion required here
		
		console.log(`${MODULE_ID} | collectItemsFromFolder - final items:`, items);
		return items;
	}

	function isFolderOrAncestor(folderDoc, targetId) {
		let current = folderDoc;
		while (current) {
			if (current.id === targetId) return true;
			current = current.folder; // ascend to parent
		}
		return false;
	}

	async function getAllDescendantFolderIds(folder) {
		console.log(`${MODULE_ID} | getAllDescendantFolderIds - processing folder:`, folder.name, folder.id);
		const folderIds = [folder.id];
		
		if (folder.children && folder.children.length > 0) {
			console.log(`${MODULE_ID} | getAllDescendantFolderIds - found ${folder.children.length} children`);
			for (const childRef of folder.children) {
				console.log(`${MODULE_ID} | getAllDescendantFolderIds - child reference:`, childRef);
				
				// Try to resolve the child folder - it might be a reference or have different properties
				let childFolder = null;
				if (childRef.id) {
					childFolder = childRef; // Already resolved
				} else if (childRef.uuid) {
					childFolder = await fromUuid(childRef.uuid);
				} else if (typeof childRef === 'string') {
					// Might be a UUID string
					childFolder = await fromUuid(childRef);
				}
				
				console.log(`${MODULE_ID} | getAllDescendantFolderIds - resolved child folder:`, childFolder?.name, childFolder?.id);
				
				if (childFolder && childFolder.id) {
					const childIds = await getAllDescendantFolderIds(childFolder);
					folderIds.push(...childIds);
				}
			}
		}
		
		console.log(`${MODULE_ID} | getAllDescendantFolderIds - final folder IDs for ${folder.name}:`, folderIds);
		return folderIds.filter(id => id !== undefined); // Filter out undefined values
	}

	async function handleActorFolderDrop(data, group) {
		try {
			const folder = await fromUuid(data.uuid);
			if (!folder) return;
			
			const actors = await collectActorsFromFolder(folder);
			if (actors.length === 0) {
				ui.notifications?.warn(`No actors found in folder "${folder.name}"`);
				return;
			}

			// Check for conflicts with existing group memberships
			const all = allActorUuids(state.rules);
			const conflicts = actors.filter(actorUuid => all.has(actorUuid));
			
			if (conflicts.length > 0) {
				ui.notifications?.warn(`${conflicts.length} actor(s) from "${folder.name}" are already in other groups and will be skipped.`);
			}

			const newActors = actors.filter(actorUuid => !all.has(actorUuid));
			if (newActors.length === 0) {
				ui.notifications?.warn(`All actors from "${folder.name}" are already in other groups.`);
				return;
			}

			group.actorUUIDs = group.actorUUIDs || [];
			group.actorUUIDs.push(...newActors);

			renderGroups();
			autosave();
			ui.notifications?.info(`Added ${newActors.length} actors from "${folder.name}" to group "${group.name}"`);
		} catch (error) {
			console.error(`${MODULE_ID} | Error handling actor folder drop:`, error);
			ui.notifications?.error(`Failed to add actors from folder: ${error.message}`);
		}
	}

	async function collectActorsFromFolder(folder) {
		const actors = [];
		
		// Handle compendium folders
		if (folder.pack) {
			const pack = game.packs.get(folder.pack);
			if (pack) {
				const documents = await pack.getDocuments();
				for (const doc of documents) {
					if (doc.folder?.id === folder.id) {
						actors.push(doc.uuid);
					}
				}
			}
		} else {
			// Handle world folders
			if (folder.contents) {
				for (const actor of folder.contents) {
					actors.push(actor.uuid);
				}
			}
		}
		
		// Recursively collect from subfolders
		if (folder.children) {
			for (const childFolder of folder.children) {
				const childActors = await collectActorsFromFolder(childFolder);
				actors.push(...childActors);
			}
		}
		
		return actors;
	}

	function showBatchSettingsDialog(folderName, itemCount) { return batchDialogComponent(folderName, itemCount); }
function confirmDialog(title, message, skipConfirm = false) { return confirmDialogComponent(title, message, skipConfirm); }

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

function makeDraggable(panel, handle) { return attachDrag(panel, handle); }
function makeResizable(panel) { return attachResize(panel); }
function saveSize(panel) { return persistSize(panel); }
function loadSavedSize(panel) { return loadSavedPanelSize(panel); }


}
