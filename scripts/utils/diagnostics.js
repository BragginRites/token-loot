'use strict';

import { MODULE_ID } from './settings.js';

export function diagnosticsEnabled() {
    try {
        return !!game.user?.isGM && !!game.settings.get(MODULE_ID, 'enableDiagnostics');
    } catch {
        return false;
    }
}

export function warnDiagnostic(message, err = null) {
    if (err) {
        console.warn(`${MODULE_ID} | ${message}`, err);
    } else {
        console.warn(`${MODULE_ID} | ${message}`);
    }

    if (!diagnosticsEnabled()) return;
    ui.notifications?.warn(message);
}
