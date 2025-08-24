'use strict';

export const MODULE_ID = 'token-loot';

export function defaultSettings() {
	return {
		schema: 1,
		scopes: { world: { groups: {} }, scenes: {}, folders: {}, actors: {} }
	};
}

export function getFullSettings() {
	return game.settings.get(MODULE_ID, 'settings') ?? defaultSettings();
}

export async function setFullSettings(val) {
	return game.settings.set(MODULE_ID, 'settings', val);
}

export function getWorldRuleSet() {
	const s = getFullSettings();
	if (!s.scopes.world) s.scopes.world = { groups: {} };
	if (!s.scopes.world.groups) s.scopes.world.groups = {};
	return s.scopes.world;
}

export async function saveWorldRuleSet(worldRules) {
	const s = getFullSettings();
	s.scopes.world = worldRules;
	await setFullSettings(s);
}

export function slugify(name) {
	return String(name || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-');
}

export function allActorUuids(worldRules) {
	const uuids = new Set();
	for (const gid of Object.keys(worldRules.groups || {})) {
		for (const u of worldRules.groups[gid].actorUUIDs || []) uuids.add(u);
	}
	return uuids;
}


