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
            allActive: (block.type || 'chance') === 'all' ? 'tl-active' : '',
            pickActive: (block.type || 'chance') === 'pick' ? 'tl-active' : '',
            chanceActive: (block.type || 'chance') === 'chance' ? 'tl-active' : '',
            pickDisplay: (block.type === 'pick') ? '' : 'style="display:none"',
            chanceDisplay: (block.type === 'chance') ? '' : 'style="display:none"',
            chanceBoundsDisplay: (block.useChanceBounds) ? '' : 'style="display:none"',
            useChanceBoundsChecked: block.useChanceBounds ? 'checked' : '',
            boundsInputsDisabled: block.useChanceBounds ? '' : 'disabled',
            allowDupActive: block.allowDuplicates ? 'tl-active' : '',
            autoEquipActive: block.autoEquip ? 'tl-active' : '',
            forceQtyActive: block.useChanceBounds ? 'tl-active' : ''
        }
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}


