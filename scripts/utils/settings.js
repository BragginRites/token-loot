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

// Re-export slugify for backwards compatibility
export { slugify } from './StringUtils.js';

export function registerCoreSettings() {
	game.settings.register(MODULE_ID, 'settings', {
		name: 'Token Loot Settings',
		hint: 'Configure groups and loot.',
		scope: 'world',
		config: false,
		type: Object,
		default: defaultSettings(),
		onChange: value => {
			// Settings updated
		}
	});

	// Client UI preferences
	game.settings.register(MODULE_ID, 'groupManagerSize', {
		scope: 'client',
		config: false,
		type: Object,
		default: { width: 860, height: 620 }
	});

	// V13+ ApplicationV2 settings menu - use dynamic import to avoid circular dependency
	class TLGroupManagerMenu extends foundry.applications.api.ApplicationV2 {
		static DEFAULT_OPTIONS = {
			id: 'tl-group-manager-menu',
			window: { title: 'Loot Group Manager' }
		};

		async _renderHTML(context, options) {
			try {
				const { openGroupManager } = await import('../ui/groupManager/GroupManagerController.js');
				openGroupManager();
			} catch (e) {
				console.warn(`${MODULE_ID} | Failed to open manager`, e);
			}
			setTimeout(() => { try { this.close(); } catch { } }, 0);
			return document.createElement('div');
		}
	}

	game.settings.registerMenu(MODULE_ID, 'groupManager', {
		name: 'Loot Group Manager',
		label: 'Open Manager',
		hint: 'Manage loot groups, actors, and items.',
		icon: 'fas fa-list',
		restricted: true,
		type: TLGroupManagerMenu
	});
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


	game.settings.register(MODULE_ID, 'awardStaggerMs', {
		scope: 'world',
		config: true,
		name: 'Loot Award Stagger (ms)',
		hint: 'Optional delay before awarding loot per token to reduce contention. 0 to disable.',
		type: Number,
		default: 150
	});

	game.settings.register(MODULE_ID, 'awardItemStaggerMs', {
		scope: 'world',
		config: true,
		name: 'Per-Item Award Stagger (ms)',
		hint: 'Delay between creating individual items on an actor; 0 to disable.',
		type: Number,
		default: 50
	});

	// GM chat summary toggle (off by default)
	game.settings.register(MODULE_ID, 'enableGMChatSummary', {
		scope: 'world',
		config: true,
		name: 'GM Chat Summary',
		hint: 'Post a GM-only chat summary after loot is granted for each token.',
		type: Boolean,
		default: false
	});
}
