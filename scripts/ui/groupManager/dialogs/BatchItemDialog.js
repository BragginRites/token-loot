'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Show a dialog to configure batch add of items from a folder.
 * Returns { chance, qtyMin, qtyMax, includeSubfolders } or null.
 * @param {string} folderName
 * @param {number} itemCount
 */
export async function showBatchSettingsDialog(folderName, itemCount) {
    const overlay = document.createElement('div');
    overlay.className = 'tl-confirm-overlay';
    overlay.innerHTML = await loadTemplate('batchItemDialog.html', { folderName, itemCount, includeSubfoldersChecked: '' });
    document.body.appendChild(overlay);
    return new Promise(resolve => {
        const cleanup = (result) => { try { overlay.remove(); } catch {} resolve(result); };
        overlay.querySelector('.tl-apply')?.addEventListener('click', () => {
            const chance = Number(overlay.querySelector('.tl-batch-chance')?.value) || 10;
            const qtyMin = Number(overlay.querySelector('.tl-batch-qmin')?.value) || 1;
            const qtyMax = Number(overlay.querySelector('.tl-batch-qmax')?.value) || 1;
            const includeSubfolders = !!overlay.querySelector('.tl-include-subfolders')?.checked;
            cleanup({ chance, qtyMin, qtyMax, includeSubfolders });
        });
        overlay.querySelector('.tl-cancel')?.addEventListener('click', () => cleanup(null));
        overlay.addEventListener('click', ev => { if (ev.target === overlay) cleanup(null); });
        overlay.querySelector('button')?.focus();
    });
}


