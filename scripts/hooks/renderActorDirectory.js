'use strict';

import { openGroupManager } from '../ui/groupManager/GroupManagerController.js';
import { MODULE_ID } from '../utils/settings.js';

export function setupRenderActorDirectoryHook() {
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
}


