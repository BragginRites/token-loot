'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Show a confirm dialog. If skipConfirm is true, resolves true immediately.
 * @param {string} title
 * @param {string} message
 * @param {boolean} [skipConfirm=false]
 * @returns {Promise<boolean>}
 */
export async function confirmDialog(title, message, skipConfirm = false) {
    if (skipConfirm) return true;
    const overlay = document.createElement('div');
    overlay.className = 'tl-confirm-overlay';
    overlay.innerHTML = await loadTemplate('confirmDialog.html', { title, message });
    document.body.appendChild(overlay);
    return new Promise(resolve => {
        const cleanup = (result) => { try { overlay.remove(); } catch {} resolve(result); };
        overlay.querySelector('.tl-confirm')?.addEventListener('click', () => cleanup(true));
        overlay.querySelector('.tl-cancel')?.addEventListener('click', () => cleanup(false));
        overlay.addEventListener('click', ev => { if (ev.target === overlay) cleanup(false); });
        overlay.querySelector('button')?.focus();
    });
}


