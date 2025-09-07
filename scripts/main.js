'use strict';

import { MODULE_ID, defaultSettings, registerReliabilitySettings } from './utils/settings.js';
import { openGroupManager } from './ui/groupManager/index.js';
import { enqueueActorTask, withRetries } from './domain/queue.js';
import { setupCreateTokenHook } from './hooks/createToken.js';
import { setupPreCreateTokenHook } from './hooks/preCreateToken.js';
import { setupRenderActorDirectoryHook } from './hooks/renderActorDirectory.js';
import { runMigrations } from './utils/settings.js';
import { setupBG3Compat } from './compat/bg3/index.js';

/**
 * @typedef {Object} CurrencyRow
 * @property {string} [gp]
 * @property {string} [sp]
 * @property {string} [pp]
 * @property {string} [cp]
 * @property {string} [ep]
 *
 * @typedef {Object} LootRow
 * @property {string} uuid
 * @property {number} chance // 0..100 (percent)
 * @property {number} [qtyMin]
 * @property {number} [qtyMax]
 * @property {boolean} [attune]
 * @property {boolean} [equip]
 *
 * @typedef {Object} ActorGroup
 * @property {string} id
 * @property {string} name
 * @property {string[]} actorUUIDs
 * @property {number} minItems
 * @property {number} maxItems
 * @property {boolean} allowDuplicates
 * @property {CurrencyRow} [currency]
 * @property {LootRow[]} loot
 *
 * @typedef {Object} RuleSet
 * @property {Record<string, ActorGroup>} groups
 *
 * @typedef {Object} LBASettings
 * @property {number} schema
 * @property {{ world: RuleSet, scenes: Record<string, RuleSet>, folders: Record<string, RuleSet>, actors: Record<string, RuleSet> }} scopes
 */

Hooks.once('init', () => {
	console.log(`${MODULE_ID} | Initializing`);

	game.settings.register(MODULE_ID, 'settings', {
		name: 'Token Loot Settings',
		hint: 'Configure groups and loot.',
		scope: 'world',
		config: false,
		type: Object,
		default: defaultSettings(),
		onChange: value => {
			console.debug(`${MODULE_ID} | Settings updated`, value);
		}
	});

	game.settings.registerMenu(MODULE_ID, 'groupManager', {
		name: 'Loot Group Manager',
		label: 'Open Manager',
		hint: 'Manage loot groups, actors, and items.',
		icon: 'fas fa-list',
		restricted: true,
		type: class TLGroupManagerMenu extends FormApplication {
			render(force, options) {
				try { openGroupManager(); } catch (e) { console.warn(`${MODULE_ID} | Failed to open manager`, e); }
				try { this.close({ force: true }); } catch {}
				return this;
			}
		}
	});

	game.settings.register(MODULE_ID, 'enablePrompt', {
		scope: 'world',
		config: true,
		name: 'GM Prompt on Loot',
		hint: 'Ask GM how to apply equip/attune on createToken.',
		type: Boolean,
		default: false
	});

	// Reliability and timing controls
	registerReliabilitySettings();

	// Client UI preferences
	game.settings.register(MODULE_ID, 'groupManagerSize', {
		scope: 'client',
		config: false,
		type: Object,
		default: { width: 860, height: 620 }
	});
});

Hooks.once('ready', async () => {
	console.log(`${MODULE_ID} | Ready`);
	await runMigrations();
	setupCreateTokenHook();
	setupPreCreateTokenHook();
	setupRenderActorDirectoryHook();
	setupBG3Compat();
});

// Per-actor queue and retry helpers moved to scripts/domain/queue.js


/** @param {Actor} actor */
function getEffectiveRulesForActor(actor) {
	// MVP: only world scope
	return game.settings.get(MODULE_ID, 'settings')?.scopes?.world ?? { groups: {} };
}

/** @param {RuleSet} rules @param {Actor} actor */
function findGroupContainingActor(rules, actor) {
	// Collect as many potential origin UUIDs as possible
	const candidateUuids = new Set();
	candidateUuids.add(actor.uuid);
	try {
		const sid = actor.getFlag?.('core', 'sourceId');
		if (sid) candidateUuids.add(sid);
	} catch {}
	try {
		const cs = actor._stats?.compendiumSource;
		if (cs) candidateUuids.add(cs);
	} catch {}
	try {
		const ssid = actor._stats?.sourceId;
		if (ssid) candidateUuids.add(ssid);
	} catch {}
	try {
		const protoSid = actor.prototypeToken?.flags?.core?.sourceId || actor.prototypeToken?._source?.flags?.core?.sourceId;
		if (protoSid) candidateUuids.add(protoSid);
	} catch {}

	// Direct UUID match against groups
	for (const groupId of Object.keys(rules.groups ?? {})) {
		const g = rules.groups[groupId];
		for (const u of candidateUuids) if (g?.actorUUIDs?.includes(u)) return g;
	}

	// Fallback: match by canonicalized name to a world Actor UUID present in groups
	// Helps unlinked tokens that lost their sourceId and have numeric suffixes
	const canonical = (s) => String(s || '').replace(/\s+\d+$/u, '').trim().toLowerCase();
	const actorKey = canonical(actor.name);

	// Build a reverse index: worldActorUuid -> group
	const worldUuidToGroup = new Map();
	for (const groupId of Object.keys(rules.groups ?? {})) {
		const g = rules.groups[groupId];
		for (const uuid of g?.actorUUIDs ?? []) {
			if (typeof uuid === 'string' && uuid.startsWith('Actor.')) {
				worldUuidToGroup.set(uuid, g);
			}
		}
	}
	if (worldUuidToGroup.size) {
		let matchedGroup = null;
		for (const a of game.actors) {
			if (!worldUuidToGroup.has(a.uuid)) continue;
			if (canonical(a.name) === actorKey) { matchedGroup = worldUuidToGroup.get(a.uuid); break; }
		}
		if (matchedGroup) return matchedGroup;
	}

	return null;
}

/** @param {number} min @param {number} max */
function randomIntegerInclusive(min, max) {
	const a = Number.isFinite(min) ? min : 0;
	const b = Number.isFinite(max) ? max : 0;
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** @param {LootRow[]} rows */
function rollIndependentChances(rows) {
	const successes = [];
	for (const row of rows ?? []) {
		const p = typeof row.chance === 'number' ? row.chance : 0;
		if (Math.random() * 100 < p) successes.push(row);
	}
	return successes;
}

/** Without replacement. @param {LootRow[]} successes @param {LootRow[]} pool @param {number} n */
function trimOrFillWithoutReplacement(successes, pool, n) {
	let result = [...successes];
	if (result.length > n) {
		result = randomSample(result, n);
	} else if (result.length < n) {
		const remaining = pool.filter(r => r.enabled && !result.includes(r));
		const needed = n - result.length;
		result.push(...randomSample(remaining, Math.min(needed, remaining.length)));
	}
	return result;
}

/** With replacement. @param {LootRow[]} successes @param {LootRow[]} pool @param {number} n */
function trimOrFillWithReplacement(successes, pool, n) {
	const result = [...successes];
	if (result.length > n) return randomSample(result, n);
	const needed = n - result.length;
	for (let i = 0; i < needed; i++) {
		const enabled = pool.filter(r => r.enabled);
		if (enabled.length === 0) break;
		result.push(enabled[Math.floor(Math.random() * enabled.length)]);
	}
	return result;
}

/** @template T @param {T[]} arr @param {number} k */
function randomSample(arr, k) {
	const copy = [...arr];
	const out = [];
	for (let i = 0; i < k && copy.length > 0; i++) {
		const idx = Math.floor(Math.random() * copy.length);
		out.push(copy.splice(idx, 1)[0]);
	}
	return out;
}

/** @param {Actor} actor @param {CurrencyRow} currency @param {any} grantLog */
async function applyCurrency(actor, currency, grantLog) {
	const updates = { system: { currency: foundry.utils.deepClone(actor.system.currency ?? {}) } };
	const mapping = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' };
	for (const k of Object.keys(mapping)) {
		const expr = currency[k];
		if (!expr) continue;
		let val = 0;
		const rangeMatch = /^\s*(\d+)\s*-\s*(\d+)\s*$/u.exec(String(expr));
		if (rangeMatch) {
			const min = Number(rangeMatch[1]);
			const max = Number(rangeMatch[2]);
			const lo = Math.min(min, max);
			const hi = Math.max(min, max);
			val = Math.floor(Math.random() * (hi - lo + 1)) + lo;
		} else if (/^\s*\d+\s*$/u.test(String(expr))) {
			val = Number(expr);
		} else {
			const r = new Roll(String(expr));
			await r.evaluate({ async: true });
			val = Math.max(0, Math.floor(r.total ?? 0));
		}
		updates.system.currency[k] = (updates.system.currency[k] ?? 0) + val;
		grantLog.currency[k] = (grantLog.currency[k] ?? 0) + val;
	}
	await actor.update(updates);
}

/** @param {Actor} actor @param {LootRow[]} rows @param {any} grantLog */
async function grantItems(actor, rows, grantLog) {
	const toCreate = [];
	console.log(`${MODULE_ID} | grantItems called with ${rows.length} rows`);
	for (const row of rows ?? []) {
		if (!row?.uuid) {
			console.log(`${MODULE_ID} | Skipping row without UUID:`, row);
			continue;
		}
		const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
		console.log(`${MODULE_ID} | Processing item ${row.uuid}, qty: ${qty}`);
		try {
			const doc = await fromUuid(row.uuid);
			if (!doc) {
				console.warn(`${MODULE_ID} | Could not resolve UUID: ${row.uuid}`);
				continue;
			}
			console.log(`${MODULE_ID} | Resolved item: ${doc.name}`);
			let data = doc.toObject();
			// Ensure a new embedded Item is created, not an attempt to reuse compendium/world _id
			if (data._id) delete data._id;
			data.system = data.system || {};
			data.system.quantity = qty;
			data.flags = data.flags || {};
			data.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };

			// If the granted item is a spell, let the system create the proper scroll
			try {
				if (String(data.type) === 'spell' && (game.system?.id === 'dnd5e')) {
					let scrollData = null;
					const ItemCls = (CONFIG && CONFIG.Item && CONFIG.Item.documentClass) ? CONFIG.Item.documentClass : null;
					try {
						if (ItemCls && typeof ItemCls.createScrollFromSpell === 'function') {
							const created = await ItemCls.createScrollFromSpell(doc);
							scrollData = created?.toObject ? created.toObject() : created;
						}
					} catch {}
					try {
						if (!scrollData && game?.dnd5e?.documents?.Item5e?.createScrollFromSpell) {
							const created = await game.dnd5e.documents.Item5e.createScrollFromSpell(doc);
							scrollData = created?.toObject ? created.toObject() : created;
						}
					} catch {}
					if (scrollData) {
						if (scrollData._id) delete scrollData._id;
						scrollData.system = scrollData.system || {};
						scrollData.system.quantity = qty;
						scrollData.flags = Object.assign(scrollData.flags || {}, { [MODULE_ID]: { granted: true, groupId: row.groupId ?? null, sourceSpellUuid: row.uuid } });
						data = scrollData;
					}
				}
			} catch {}

			// Auto-equip where appropriate (honor per-row autoEquip flag propagated from block)
			try {
				const t = String(data.type || '').toLowerCase();
				const shouldEquip = !!row.autoEquip;
				if (shouldEquip && game.system?.id === 'dnd5e') {
					if (t === 'weapon' || t === 'armor' || t === 'equipment') {
						data.system = data.system || {};
						if (typeof data.system.equipped === 'boolean') data.system.equipped = true;
					}
				} else if (shouldEquip && typeof data.system?.equipped === 'boolean') {
					// Generic fallback for systems that use a boolean equipped field
					data.system.equipped = true;
				}
			} catch {}
			toCreate.push(data);
			grantLog.items.push({ name: data.name, qty });
			console.log(`${MODULE_ID} | Added ${data.name} x${qty} to creation queue`);
		} catch (e) {
			console.warn(`${MODULE_ID} | Failed to resolve ${row.uuid}`, e);
		}
	}
	console.log(`${MODULE_ID} | Creating ${toCreate.length} items on actor ${actor.name}`);
	if (toCreate.length) {
		const perItemDelay = Number(game.settings.get(MODULE_ID, 'awardItemStaggerMs') || 0);
		if (perItemDelay > 0) {
			for (const data of toCreate) {
				await actor.createEmbeddedDocuments('Item', [data]);
				await new Promise(r => setTimeout(r, perItemDelay));
			}
			console.log(`${MODULE_ID} | Successfully created ${toCreate.length} items (staggered)`);
		} else {
			await actor.createEmbeddedDocuments('Item', toCreate);
			console.log(`${MODULE_ID} | Successfully created ${toCreate.length} items`);
		}
	}
}

/** @param {Actor} actor @param {ActorGroup} group @param {any} grantLog */
async function postGMChatLog(actor, group, grantLog) {
	try {
		const enabled = !!game.settings.get(MODULE_ID, 'enableGMChatSummary');
		if (!enabled) return;
	} catch {}
	const lines = [];
	lines.push(`<strong>${actor.name}</strong> received loot from group <em>${group.name}</em>:`);
	
	let hasLoot = false;
	
	if (Object.keys(grantLog.currency).length) {
		const cur = Object.entries(grantLog.currency)
			.filter(([k,v]) => v > 0)
			.map(([k,v]) => `${v} ${k.toUpperCase()}`)
			.join(', ');
		if (cur) {
			lines.push(`💰 Currency: ${cur}`);
			hasLoot = true;
		}
	}
	
	if (grantLog.items.length) {
		lines.push(`📦 Items:`);
		for (const it of grantLog.items) {
			lines.push(`&nbsp;&nbsp;• ${it.qty}x ${it.name}`);
		}
		hasLoot = true;
	}
	
	if (!hasLoot) {
		lines.push(`<em>No items or currency granted.</em>`);
	}
	
	console.log(`${MODULE_ID} | Chat log:`, lines.join(' '));
	
	const content = `<div class="token-loot-log">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
	try {
		await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients('GM').map(u => u.id) });
		console.log(`${MODULE_ID} | Chat message created successfully`);
	} catch (e) {
		console.warn(`${MODULE_ID} | Failed to create chat message (probably module conflict):`, e);
		// Fallback: just log to console
		console.log(`${MODULE_ID} | Loot Summary: ${lines.join(' ')}`);
	}
}

// Add an "Open Loot Groups" button to the Actor Directory footer (v13-safe)
function injectLootGroupsButton(rootEl) {
	try {
		if (!rootEl || !rootEl.querySelector) return;
		const container = rootEl.querySelector('.directory-footer') || rootEl.querySelector('footer');
		if (!container) return;
		if (container.querySelector('.tl-open-manager')) return;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'tl-open-manager';
		btn.innerHTML = '<i class="fas fa-list"></i> Loot Groups';
		btn.addEventListener('click', () => openGroupManager());
		container.appendChild(btn);
	} catch (e) {
		console.warn(`${MODULE_ID} | Failed to inject Loot Groups button`, e);
	}
}

Hooks.on('renderActorDirectory', (app, html) => {
	const root = (html?.[0]) || html || (app?.element?.[0]) || app?.element || null;
	injectLootGroupsButton(root || document.querySelector('#actors'));
});

Hooks.on('renderSidebarTab', (app, html) => {
	try {
		const isActors = (app?.tabName === 'actors') || (app?.options?.id === 'actors') || (app?.id === 'actors');
		if (!isActors) return;
		const root = (html?.[0]) || html || (app?.element?.[0]) || app?.element || document.querySelector('#actors');
		injectLootGroupsButton(root);
	} catch (e) {
		console.warn(`${MODULE_ID} | renderSidebarTab injection failed`, e);
	}
});


