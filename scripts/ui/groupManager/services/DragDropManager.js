'use strict';

/**
 * Enable a drop target with Foundry-style text/plain JSON payloads.
 * @param {HTMLElement} el
 * @param {(data: any) => Promise<void>} onDrop
 */
export function enableDroppable(el, onDrop) {
    el.addEventListener('dragover', ev => { ev.preventDefault(); el.classList.add('drag'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag'));
    el.addEventListener('drop', async ev => {
        ev.preventDefault(); el.classList.remove('drag');
        const data = parseDrop(ev);
        if (data) await onDrop(data);
    });
}

/**
 * Parse drag payload from a drop event.
 * @param {DragEvent} ev
 */
export function parseDrop(ev) {
    try {
        const txt = ev.dataTransfer?.getData('text/plain');
        if (!txt) return null;
        return JSON.parse(txt);
    } catch { return null; }
}


