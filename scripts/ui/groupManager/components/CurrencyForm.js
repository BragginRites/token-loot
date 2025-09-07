'use strict';

/**
 * Attach listeners to currency inputs for a group.
 * @param {HTMLElement} root
 * @param {any} group
 * @param {() => void} onChange
 */
export function bindCurrencyForm(root, group, onChange) {
    ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(curr => {
        root.querySelector(`.tl-${curr}`)?.addEventListener('input', ev => {
            if (!group.currency) group.currency = {};
            group.currency[curr] = ev.currentTarget.value.trim() || '';
            onChange();
        });
    });
}


