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

	// Reliability and timing controls
	game.settings.register(MODULE_ID, 'usePreCreateForUnlinked', {
		scope: 'world',
		config: true,
		name: 'Apply Loot in preCreate for Unlinked Tokens',
		hint: 'When enabled, unlinked tokens receive loot in preCreate, avoiding race conditions.',
		type: Boolean,
		default: false
	});

	game.settings.register(MODULE_ID, 'awardStaggerMs', {
		scope: 'world',
		config: true,
		name: 'Loot Award Stagger (ms)',
		hint: 'Optional delay before awarding loot per token to reduce contention. 0 to disable.',
		type: Number,
		default: 0
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

// Per-actor queue and retry helpers (to avoid concurrency issues)
const __actorQueues = new Map();
function enqueueActorTask(actorId, taskFn) {
	const prev = __actorQueues.get(actorId) || Promise.resolve();
	const next = prev.then(() => taskFn()).catch(e => { console.error(`${MODULE_ID} | Actor queue task failed`, e); }).finally(() => {
		if (__actorQueues.get(actorId) === next) __actorQueues.delete(actorId);
	});
	__actorQueues.set(actorId, next);
	return next;
}

async function withRetries(fn, attempts = 3, baseDelayMs = 50) {
	let n = 0;
	for (;;) {
		try { return await fn(); }
		catch (e) {
			n++;
			if (n >= attempts) throw e;
			await new Promise(r => setTimeout(r, baseDelayMs * n));
		}
	}
}

// Apply loot after the token is created so we can modify the token's actor (especially for unlinked tokens)
Hooks.on('createToken', async (tokenDocument, options, userId) => {
	try {
		if (!game.user.isGM) return; // Only GM applies loot
		const actor = tokenDocument?.actor;
		if (!actor) return;

		console.log(`${MODULE_ID} | Processing token creation for actor: ${actor.name}`);

		// If loot was applied earlier in preCreate (for unlinked), only post the chat here
		try {
			const preApplied = tokenDocument.getFlag(MODULE_ID, 'preApplied');
			if (preApplied) {
				const rules = getEffectiveRulesForActor(actor);
				const group = rules ? findGroupContainingActor(rules, actor) : null;
				const grantLog = tokenDocument.getFlag(MODULE_ID, 'grantLog') || { currency: {}, items: [] };
				if (group) await postGMChatLog(actor, group, grantLog);
				return;
			}
		} catch {}

		const staggerMs = Number(game.settings.get(MODULE_ID, 'awardStaggerMs') || 0);

		await enqueueActorTask(actor.id, async () => {
			if (staggerMs > 0) await new Promise(r => setTimeout(r, staggerMs));

			const rules = getEffectiveRulesForActor(actor);
			if (!rules) {
				console.log(`${MODULE_ID} | No rules found for actor`);
				return;
			}

			// Find exactly one group containing this actor
			const group = findGroupContainingActor(rules, actor);
			if (!group) {
				console.log(`${MODULE_ID} | No group found containing actor: ${actor.name}`);
				return;
			}

			console.log(`${MODULE_ID} | Found group: ${group.name} for actor: ${actor.name}`);
			console.log(`${MODULE_ID} | Group has ${(group.distributionBlocks || []).length} distribution blocks`);

			const grantLog = { currency: {}, items: [] };

			// 1) Currency
			if (group.currency) {
				await withRetries(() => applyCurrency(actor, group.currency, grantLog));
			}

			// 2) Process each distribution block
			for (const block of group.distributionBlocks || []) {
				console.log(`${MODULE_ID} | Processing block: ${block.name} (type: ${block.type})`);
				console.log(`${MODULE_ID} | Block has ${(block.items || []).length} items`);
				
				if (!block.items || block.items.length === 0) {
					console.log(`${MODULE_ID} | Skipping empty block: ${block.name}`);
					continue;
				}
				
				let chosenItems = [];
				
				if (block.type === 'all') {
					// Grant all items in the block
					chosenItems = [...(block.items || [])];
					console.log(`${MODULE_ID} | All items mode: selected ${chosenItems.length} items`);
				} else if (block.type === 'pick') {
					// Pick N items from the block
					const count = block.count || 1;
					const availableItems = block.items.filter(item => item.uuid);
					console.log(`${MODULE_ID} | Pick mode: selecting ${count} from ${availableItems.length} available items`);
					if (block.allowDuplicates) {
						// Pick with replacement
						for (let i = 0; i < count && availableItems.length > 0; i++) {
							chosenItems.push(availableItems[Math.floor(Math.random() * availableItems.length)]);
						}
					} else {
						// Pick without replacement
						chosenItems = randomSample(availableItems, Math.min(count, availableItems.length));
					}
					console.log(`${MODULE_ID} | Pick mode: chose ${chosenItems.length} items`);
				} else if (block.type === 'chance') {
					// Roll to meet a target count between chanceMin and chanceMax
					const minCount = Math.max(0, Number(block.chanceMin ?? 1));
					const maxCount = Math.max(minCount, Number(block.chanceMax ?? minCount));
					const target = randomIntegerInclusive(minCount, maxCount);
					const pool = [...(block.items || [])];
					const successes = [];
					// Keep rolling through pool (shuffled each pass) until target met or pool exhausted (unless duplicates allowed)
					const allowDup = !!block.allowDuplicates;
					let safety = 1000;
					while (successes.length < target && safety-- > 0) {
						const order = [...pool];
						// Shuffle order
						for (let i = order.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[order[i], order[j]] = [order[j], order[i]];
						}
						for (const row of order) {
							const p = typeof row.chance === 'number' ? row.chance : 0;
							if (Math.random() * 100 < p) {
								successes.push(row);
								if (!allowDup) {
									// remove from pool to avoid picking again
									const idx = pool.indexOf(row);
									if (idx >= 0) pool.splice(idx, 1);
								}
								if (successes.length >= target) break;
							}
						}
						if (!allowDup && pool.length === 0) break;
					}
					chosenItems = successes;
					console.log(`${MODULE_ID} | Chance mode: target ${target}, selected ${chosenItems.length}`);
				}
				
				console.log(`${MODULE_ID} | Granting ${chosenItems.length} items from block: ${block.name}`);
				// Grant the chosen items
				await withRetries(() => grantItems(actor, chosenItems, grantLog));
			}

			// 3) Chat log
			await postGMChatLog(actor, group, grantLog);
		});
	} catch (err) {
		console.error(`${MODULE_ID} | Error applying loot on token creation`, err);
	}
});

Hooks.on('preCreateToken', async (tokenDocument, data, options, userId) => {
	try {
		if (!game.user.isGM) return;
		const enabled = !!game.settings.get(MODULE_ID, 'usePreCreateForUnlinked');
		if (!enabled) return;
		const isLinked = !!(data.actorLink ?? tokenDocument?.actorLink);
		if (isLinked) return; // Only apply to unlinked tokens here

		// Resolve base actor
		const baseActorId = data.actorId || tokenDocument?.actor?.id;
		const baseActor = baseActorId ? game.actors?.get(baseActorId) : null;
		if (!baseActor) return;

		const rules = getEffectiveRulesForActor(baseActor);
		if (!rules) return;
		const group = findGroupContainingActor(rules, baseActor);
		if (!group) return;

		const grantLog = { currency: {}, items: [] };

		// Currency increments into token's actorData
		const currencyIncr = {};
		if (group.currency) {
			const mapping = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' };
			for (const k of Object.keys(mapping)) {
				const expr = group.currency[k];
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
				if (val > 0) {
					currencyIncr[k] = (currencyIncr[k] ?? 0) + val;
					grantLog.currency[k] = (grantLog.currency[k] ?? 0) + val;
				}
			}
		}

		// Select items according to blocks
		const chosenRows = [];
		for (const block of group.distributionBlocks || []) {
			if (!block.items || block.items.length === 0) continue;
			let chosenItems = [];
			if (block.type === 'all') {
				chosenItems = [...(block.items || [])];
			} else if (block.type === 'pick') {
				const count = block.count || 1;
				const availableItems = block.items.filter(item => item.uuid);
				if (block.allowDuplicates) {
					for (let i = 0; i < count && availableItems.length > 0; i++) {
						chosenItems.push(availableItems[Math.floor(Math.random() * availableItems.length)]);
					}
				} else {
					chosenItems = randomSample(availableItems, Math.min(count, availableItems.length));
				}
			} else if (block.type === 'chance') {
				const minCount = Math.max(0, Number(block.chanceMin ?? 1));
				const maxCount = Math.max(minCount, Number(block.chanceMax ?? minCount));
				const target = randomIntegerInclusive(minCount, maxCount);
				const pool = [...(block.items || [])];
				const successes = [];
				const allowDup = !!block.allowDuplicates;
				let safety = 1000;
				while (successes.length < target && safety-- > 0) {
					const order = [...pool];
					for (let i = order.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[order[i], order[j]] = [order[j], order[i]];
					}
					for (const row of order) {
						const p = typeof row.chance === 'number' ? row.chance : 0;
						if (Math.random() * 100 < p) {
							successes.push(row);
							if (!allowDup) {
								const idx = pool.indexOf(row);
								if (idx >= 0) pool.splice(idx, 1);
							}
							if (successes.length >= target) break;
						}
					}
					if (!allowDup && pool.length === 0) break;
				}
				chosenItems = successes;
			}
			chosenRows.push(...chosenItems);
		}

		// Resolve to embedded item data & attach to token data
		const toCreate = [];
		for (const row of chosenRows ?? []) {
			if (!row?.uuid) continue;
			const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
			try {
				const doc = await fromUuid(row.uuid);
				if (!doc) continue;
				const dataObj = doc.toObject();
				if (dataObj._id) delete dataObj._id;
				dataObj.system = dataObj.system || {};
				dataObj.system.quantity = qty;
				dataObj.flags = dataObj.flags || {};
				dataObj.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };
				toCreate.push(dataObj);
				grantLog.items.push({ name: dataObj.name, qty });
			} catch {}
		}

		data.actorData = data.actorData || {};
		if (Object.keys(currencyIncr).length) {
			const cur = foundry.utils.deepClone((baseActor.system?.currency) ?? {});
			for (const [k, v] of Object.entries(currencyIncr)) cur[k] = (cur[k] ?? 0) + Number(v);
			data.actorData.system = data.actorData.system || {};
			data.actorData.system.currency = cur;
		}
		if (toCreate.length) {
			const existing = Array.isArray(data.actorData.items) ? data.actorData.items : [];
			data.actorData.items = existing.concat(toCreate);
		}

		// Flag for post-chat and to avoid double granting
		data.flags = data.flags || {};
		data.flags[MODULE_ID] = data.flags[MODULE_ID] || {};
		data.flags[MODULE_ID].preApplied = true;
		data.flags[MODULE_ID].grantLog = grantLog;
	} catch (e) {
		console.warn(`${MODULE_ID} | preCreateToken failed`, e);
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
			const data = doc.toObject();
			// Ensure a new embedded Item is created, not an attempt to reuse compendium/world _id
			if (data._id) delete data._id;
			data.system = data.system || {};
			data.system.quantity = qty;
			data.flags = data.flags || {};
			data.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };
			toCreate.push(data);
			grantLog.items.push({ name: data.name, qty });
			console.log(`${MODULE_ID} | Added ${data.name} x${qty} to creation queue`);
		} catch (e) {
			console.warn(`${MODULE_ID} | Failed to resolve ${row.uuid}`, e);
		}
	}
	console.log(`${MODULE_ID} | Creating ${toCreate.length} items on actor ${actor.name}`);
	if (toCreate.length) {
		await actor.createEmbeddedDocuments('Item', toCreate);
		console.log(`${MODULE_ID} | Successfully created ${toCreate.length} items`);
	}
}

/** @param {Actor} actor @param {ActorGroup} group @param {any} grantLog */
async function postGMChatLog(actor, group, grantLog) {
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


