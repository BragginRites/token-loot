'use strict';

/**
 * Compatibility helpers for Foundry V12/V13/V15+
 * Prefer modern namespaced APIs, fallback to legacy globals
 */

/**
 * Render Handlebars template (compatible across versions)
 * @param {string} path - Template path
 * @param {object} data - Template data
 * @returns {Promise<string>}
 */
export function renderHandlebarsTemplate(path, data) {
  const renderer = foundry?.applications?.handlebars?.renderTemplate;
  if (renderer) {
    return renderer(path, data);
  }
  if (typeof renderTemplate !== 'undefined') {
    return renderTemplate(path, data);
  }
  throw new Error("Unable to resolve Handlebars template renderer");
}

export function loadHandlebarsTemplates(paths) {
  const loader = foundry?.applications?.handlebars?.loadTemplates;
  if (loader) {
    return loader(paths);
  }
  if (typeof loadTemplates !== 'undefined') {
    return loadTemplates(paths);
  }
  throw new Error("Unable to resolve Handlebars template loader");
}

export function getActorSheetClass() {
  const modern = foundry?.appv1?.sheets?.ActorSheet;
  if (modern) return modern;
  if (typeof ActorSheet !== 'undefined') return ActorSheet;
  throw new Error("Unable to resolve ActorSheet class");
}

export function getItemSheetClass() {
  return foundry?.appv1?.sheets?.ItemSheet ?? ItemSheet;
}
