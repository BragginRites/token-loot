'use strict';

export const MODULE_ID = 'token-loot';

export function defaultSettings() {
	return {
		schema: 2,
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



export async function runMigrations() {
	const current = getFullSettings();
	let migrated = false;

	if (!current.schema || current.schema < 2) {
		const scopes = current.scopes || {};
		for (const scopeKey of Object.keys(scopes)) {
			const scope = scopes[scopeKey] || {};
			const groups = scope.groups || {};
			for (const gid of Object.keys(groups)) {
				const g = groups[gid] || {};
				const blocks = g.distributionBlocks || [];
				for (const b of blocks) {
					if (b && b.type === 'chance') {
						if (b.chanceMin == null) b.chanceMin = 1;
						if (b.chanceMax == null) b.chanceMax = b.chanceMin;
						if (b.useChanceBounds == null) b.useChanceBounds = false;
					}
				}
				g.distributionBlocks = blocks;
			}
			scope.groups = groups;
		}
		current.scopes = scopes;
		current.schema = 2;
		migrated = true;
	}

	if (migrated) await setFullSettings(current);
}

export function registerReliabilitySettings() {
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

	game.settings.register(MODULE_ID, 'awardItemStaggerMs', {
		scope: 'world',
		config: true,
		name: 'Per-Item Award Stagger (ms)',
		hint: 'Delay between creating individual items on an actor; 0 to disable.',
		type: Number,
		default: 50
	});
}


