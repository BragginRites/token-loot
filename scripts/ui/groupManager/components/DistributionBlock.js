'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

/**
 * Render a distribution block element from data.
 * @param {any} block
 * @returns {Promise<HTMLElement>}
 */
export async function renderDistributionBlock(block) {
    const html = await loadTemplate('distributionBlock.html', {
        block: {
            ...block,
            allActive: (block.type || 'all') === 'all' ? 'tl-active' : '',
            pickActive: (block.type || 'all') === 'pick' ? 'tl-active' : '',
            chanceActive: (block.type || 'all') === 'chance' ? 'tl-active' : '',
            pickDisplay: (block.type === 'pick') ? '' : 'style="display:none"',
            chanceDisplay: (block.type === 'chance') ? '' : 'style="display:none"',
            allowDuplicatesChecked: block.allowDuplicates ? 'checked' : '',
            autoEquipChecked: block.autoEquip ? 'checked' : ''
        }
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


