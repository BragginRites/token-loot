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
            invalidClass: '', // Invalid items are now filtered out instead of shown
            invalidTitle: ''
        }
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


