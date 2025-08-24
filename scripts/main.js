'use strict';

import { MODULE_ID, defaultSettings } from './utils/settings.js';
import { openGroupManager } from './ui/groupManager.js';

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
				super.render(force, options);
				try { openGroupManager(); } finally { this.close({ force: true }); }
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

	// Client UI preferences
	game.settings.register(MODULE_ID, 'groupManagerSize', {
		scope: 'client',
		config: false,
		type: Object,
		default: { width: 860, height: 620 }
	});
});

Hooks.once('ready', () => {
	console.log(`${MODULE_ID} | Ready`);
});

// Add an "Open Loot Groups" button to the Actor Directory footer
Hooks.on('renderActorDirectory', (app, html) => {
	try {
		const root = (html?.[0]) || html || (app?.element?.[0]) || app?.element || null;
		const container = (root && root.querySelector) ? (root.querySelector('.directory-footer') || root.querySelector('footer')) : document.querySelector('#actors .directory-footer');
		if (!container) return;
		if (container.querySelector?.('.tl-open-manager')) return;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'tl-open-manager';
		btn.innerHTML = '<i class="fas fa-list"></i> Loot Groups';
		btn.addEventListener('click', () => openGroupManager());
		container.appendChild(btn);
	} catch (e) {
		console.warn(`${MODULE_ID} | Failed to inject Actor Directory button`, e);
	}
});

// Apply loot after the token is created so we can modify the token's actor (especially for unlinked tokens)
Hooks.on('createToken', async (tokenDocument, options, userId) => {
	try {
		if (!game.user.isGM) return; // Only GM applies loot
		const actor = tokenDocument?.actor;
		if (!actor) return;

		const rules = getEffectiveRulesForActor(actor);
		if (!rules) return;

		// Find exactly one group containing this actor
		const group = findGroupContainingActor(rules, actor);
		if (!group) return;

		const grantLog = { currency: {}, items: [] };

		// 1) Determine N
		const numToGrant = randomIntegerInclusive(group.minItems ?? 0, group.maxItems ?? 0);

		// 2) Currency
		if (group.currency) {
			await applyCurrency(actor, group.currency, grantLog);
		}

		// 3) Independent chance per item
		const successes = rollIndependentChances(group.loot);
		let chosen = successes;
		if (!group.allowDuplicates) {
			chosen = trimOrFillWithoutReplacement(successes, group.loot, numToGrant);
		} else {
			chosen = trimOrFillWithReplacement(successes, group.loot, numToGrant);
		}

		// 6) Apply quantities & create
		await grantItems(actor, chosen, grantLog);

		// 7) Chat log
		await postGMChatLog(actor, group, grantLog);
	} catch (err) {
		console.error(`${MODULE_ID} | Error applying loot on token creation`, err);
	}
});

// JSON editor removed in favor of custom dialog

/** @param {Actor} actor */
function getEffectiveRulesForActor(actor) {
	// MVP: only world scope
	return game.settings.get(MODULE_ID, 'settings')?.scopes?.world ?? { groups: {} };
}

/** @param {RuleSet} rules @param {Actor} actor */
function findGroupContainingActor(rules, actor) {
	const candidateUuids = new Set([actor.uuid]);
	try {
		const sourceId = actor.getFlag('core', 'sourceId');
		if (sourceId) candidateUuids.add(sourceId);
	} catch {}
	for (const groupId of Object.keys(rules.groups ?? {})) {
		const g = rules.groups[groupId];
		for (const u of candidateUuids) if (g?.actorUUIDs?.includes(u)) return g;
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
		const dice = currency[k];
		if (!dice) continue;
		const r = new Roll(dice);
		await r.evaluate({ async: true });
		const val = Math.max(0, Math.floor(r.total ?? 0));
		updates.system.currency[k] = (updates.system.currency[k] ?? 0) + val;
		grantLog.currency[k] = (grantLog.currency[k] ?? 0) + val;
	}
	await actor.update(updates);
}

/** @param {Actor} actor @param {LootRow[]} rows @param {any} grantLog */
async function grantItems(actor, rows, grantLog) {
	const toCreate = [];
	for (const row of rows ?? []) {
		if (!row?.enabled || !row.uuid) continue;
		const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
		try {
			const doc = await fromUuid(row.uuid);
			if (!doc) continue;
			const data = doc.toObject();
			// Ensure a new embedded Item is created, not an attempt to reuse compendium/world _id
			if (data._id) delete data._id;
			data.system = data.system || {};
			data.system.quantity = qty;
			data.flags = data.flags || {};
			data.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };
			toCreate.push(data);
			grantLog.items.push({ name: data.name, qty });
		} catch (e) {
			console.warn(`${MODULE_ID} | Failed to resolve ${row.uuid}`, e);
		}
	}
	if (toCreate.length) await actor.createEmbeddedDocuments('Item', toCreate);
}

/** @param {Actor} actor @param {ActorGroup} group @param {any} grantLog */
async function postGMChatLog(actor, group, grantLog) {
	const lines = [];
	lines.push(`<strong>${actor.name}</strong> received loot from group <em>${group.name}</em>.`);
	if (Object.keys(grantLog.currency).length) {
		const cur = Object.entries(grantLog.currency).map(([k,v]) => `${v} ${k}`).join(', ');
		lines.push(`Currency: ${cur}`);
	}
	if (grantLog.items.length) {
		for (const it of grantLog.items) lines.push(`${it.qty}x ${it.name}`);
	}
	const content = `<div class="token-loot-log">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
	await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients('GM').map(u => u.id) });
}


