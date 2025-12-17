'use strict';

import { MODULE_ID, registerCoreSettings, registerReliabilitySettings } from '../utils/settings.js';
import { runMigrations } from '../utils/settings.js';
import { DnD5eAdapter } from '../adapters/DnD5eAdapter.js';
import { Pf2eAdapter } from '../adapters/Pf2eAdapter.js';
import { Pf1eAdapter } from '../adapters/Pf1eAdapter.js';
import { Sf1eAdapter } from '../adapters/Sf1eAdapter.js';
import { Sw5eAdapter } from '../adapters/Sw5eAdapter.js';
import { SystemAdapter } from '../adapters/SystemAdapter.js';

export function setupInitHook() {
    Hooks.once('init', () => {
        console.log(`${MODULE_ID} | Initializing`);

        // Adapter Factory
        let adapter;
        switch (game.system.id) {
            case 'dnd5e': adapter = new DnD5eAdapter(); break;
            case 'pf2e': adapter = new Pf2eAdapter(); break;
            case 'pf1': adapter = new Pf1eAdapter(); break;
            case 'sfrpg': adapter = new Sf1eAdapter(); break; // Starfinder 1e system id is 'sfrpg'
            case 'sw5e': adapter = new Sw5eAdapter(); break;
            default: adapter = new SystemAdapter(); break;
        }

        // Double check SF1e system ID. Usually 'sfrpg'.
        if (game.system.id === 'starfinder') adapter = new Sf1eAdapter();

        game.tokenLoot = game.tokenLoot || {};
        game.tokenLoot.adapter = adapter;

        registerCoreSettings();
        registerReliabilitySettings();
    });

    Hooks.once('ready', async () => {
        await runMigrations();
    });
}
