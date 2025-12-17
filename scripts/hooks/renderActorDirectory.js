'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { openGroupManager } from '../ui/groupManager/GroupManagerController.js';

export function setupRenderActorDirectoryHook() {
    function injectLootGroupsButton(rootEl) {
        try {
            if (!rootEl || !rootEl.querySelector) return;
            // V13 sidebar structure
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

    // V13: renderActorDirectory hook
    Hooks.on('renderActorDirectory', (app, html) => {
        const root = html instanceof HTMLElement ? html : html?.[0] ?? app?.element ?? null;
        injectLootGroupsButton(root || document.querySelector('#actors'));
    });

    // V13: changeSidebarTab fallback
    Hooks.on('changeSidebarTab', (app) => {
        try {
            const isActors = app?.tabName === 'actors' || app?.id === 'actors';
            if (!isActors) return;
            setTimeout(() => {
                const root = app?.element instanceof HTMLElement ? app.element : app?.element?.[0] ?? document.querySelector('#actors');
                injectLootGroupsButton(root);
            }, 50);
        } catch (e) {
            console.warn(`${MODULE_ID} | changeSidebarTab injection failed`, e);
        }
    });
}
