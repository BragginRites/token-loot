'use strict';

import { MODULE_ID } from '../../utils/settings.js';
import { waitForGrants } from '../../domain/grantTracker.js';

export function setupBG3Compat() {
    const bg3 = game.modules.get('bg3-inspired-hud');
    if (!bg3?.active) return;

    try {
        const mod = game.modules.get(MODULE_ID);
        if (mod) mod.api = Object.assign(mod.api || {}, { waitForGrants });
    } catch {}

    // Optionally, other BG3-specific wiring can be placed here.
}


