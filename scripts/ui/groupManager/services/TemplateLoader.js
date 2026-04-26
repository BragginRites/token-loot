'use strict';

import { renderHandlebarsTemplate } from '../../../compat.js';

/**
 * Load an HTML template from the `templates/` directory using Foundry's native Handlebars.
 * @param {string} path Relative path under templates/, e.g., 'groupManager.html'
 * @param {Record<string, any>} [data]
 * @returns {Promise<string>} HTML string
 */
export async function loadTemplate(path, data = {}) {
    const key = String(path || '').trim();
    if (!key) return '';
    const fullPath = `modules/token-loot/templates/${key}`;
    return renderHandlebarsTemplate(fullPath, data);
}

export function clearTemplateCache() {
    // Native handlebars manages its own cache
}


