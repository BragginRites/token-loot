'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Render an item row element.
 * @param {any} item
 */
export async function renderItemRow(item) {
    const html = await loadTemplate('itemRow.html', {
        item: {
            ...item,
            chanceDisplay: item.showChance ? '' : 'style="display:none"'
        }
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


