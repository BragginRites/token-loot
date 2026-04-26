'use strict';

/**
 * Attach listeners to currency inputs for a group.
 * @param {HTMLElement} root
 * @param {any} group
 * @param {() => void} onChange
 */
export function bindCurrencyForm(root, group, onChange) {
    root.querySelectorAll('.tl-currency-input').forEach(input => {
        input.addEventListener('input', ev => {
            const key = ev.currentTarget.dataset.key;
            if (!key) return;

            if (!group.currency) group.currency = {};
            group.currency[key] = ev.currentTarget.value.trim() || '';
            onChange();
        });
    });
}


