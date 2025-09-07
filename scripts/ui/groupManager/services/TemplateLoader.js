'use strict';

const __templateCache = new Map();

/**
 * Load an HTML template from the `templates/` directory with simple {{placeholders}} replacement.
 * @param {string} path Relative path under templates/, e.g., 'groupManager.html'
 * @param {Record<string, any>} [data]
 * @returns {Promise<string>} HTML string
 */
export async function loadTemplate(path, data = {}) {
    const key = String(path || '').trim();
    if (!key) return '';
    let tpl = __templateCache.get(key);
    if (!tpl) {
        const res = await fetch(`modules/token-loot/templates/${key}`);
        tpl = await res.text();
        __templateCache.set(key, tpl);
    }
    return replacePlaceholders(tpl, data);
}

/**
 * Replace {{key}} with String(data[key]). Does not support loops/conditionals.
 * @param {string} src
 * @param {Record<string, any>} data
 */
function replacePlaceholders(src, data) {
    return String(src).replace(/\{\{\s*([\w.]+)\s*\}\}/gu, (_, k) => {
        const val = k.split('.').reduce((o, part) => (o && o[part] != null ? o[part] : ''), data);
        return foundry.utils.escapeHTML(String(val ?? ''));
    });
}

export function clearTemplateCache() {
    __templateCache.clear();
}


