'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Render a group card element from data.
 * @param {any} group
 * @returns {Promise<HTMLElement>}
 */
export async function renderGroupCard(group) {
    const html = await loadTemplate('groupCard.html', { group });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


