'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Render a group card element from data.
 * @param {any} group
 * @returns {Promise<HTMLElement>}
 */
export async function renderGroupCard(group) {
    const adapter = game.tokenLoot?.adapter || { getCurrencyConfiguration: () => ({ gp: 'GP' }) };
    const config = adapter.getCurrencyConfiguration();
    const currencies = Object.entries(config).map(([key, label]) => ({
        key,
        label,
        value: group.currency?.[key] || ''
    }));

    const html = await loadTemplate('groupCard.html', { group, currencies });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


