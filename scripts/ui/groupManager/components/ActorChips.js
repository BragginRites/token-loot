'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Render an actor chip element.
 * @param {{ uuid: string, img?: string, name?: string }} actor
 */
export async function renderActorChip(actor) {
    const html = await loadTemplate('actorChip.html', { actor });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


