'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';
import { renderDistributionBlock } from '../components/DistributionBlock.js';
import { renderItemRow } from '../components/ItemsList.js';
import { BlockEventHandlers } from '../handlers/BlockEventHandlers.js';
import { ItemValidator } from '../services/ItemValidator.js';

/**
 * Handles rendering of distribution blocks and their items
 */
export class BlockRenderer {

    /**
     * Render all distribution blocks for a group (initial load)
     * @param {HTMLElement} blocksEl - The container element for blocks
     * @param {Object} group - The group data object
     * @param {Object} autoSave - AutoSave manager instance
     */
    static async renderDistributionBlocks(blocksEl, group, autoSave) {
        blocksEl.innerHTML = '';

        for (const block of (group.distributionBlocks || [])) {
            const blockEl = await this.renderSingleBlock(block, group, autoSave);
            blocksEl.appendChild(blockEl);
        }
    }

    /**
     * Append a single block to the container (incremental)
     * @param {HTMLElement} blocksEl
     * @param {Object} group
     * @param {Object} block
     * @param {Object} autoSave
     */
    static async appendBlock(blocksEl, group, block, autoSave) {
        const blockEl = await this.renderSingleBlock(block, group, autoSave);
        blocksEl.appendChild(blockEl);
    }

    /**
     * Render a single distribution block with items and events
     * @param {Object} block - The block data object
     * @param {Object} group - The parent group data object
     * @param {Object} autoSave - AutoSave manager instance
     * @returns {Promise<HTMLElement>} The rendered block element
     */
    static async renderSingleBlock(block, group, autoSave) {
        const blockEl = await renderDistributionBlock(block);

        // Set up items list
        await this.setupBlockItems(blockEl, block);

        // Set up all block event handlers
        await BlockEventHandlers.setupBlockEvents(blockEl, block, group, autoSave);

        return blockEl;
    }

    /**
     * Set up items list within a block
     * @param {HTMLElement} blockEl - The block DOM element
     * @param {Object} block - The block data object
     */
    static async setupBlockItems(blockEl, block) {
        const itemsRoot = blockEl.querySelector('.tl-items');

        // Render header
        const headerHtml = await loadTemplate('itemHeader.html', {
            chanceHeaderDisplay: (block.type === 'chance') ? '' : 'style="display:none"'
        });
        const headerWrap = document.createElement('div');
        headerWrap.innerHTML = headerHtml.trim();
        itemsRoot.appendChild(headerWrap.firstElementChild);

        // Process and render items
        const { validItems } = await ItemValidator.processItems(block.items || []);

        // Remove invalid items from the block data
        block.items = ItemValidator.filterValidItems(block.items || [], validItems);

        // Render item rows
        for (const row of validItems) {
            const rowData = { ...row, showChance: block.type === 'chance' };
            itemsRoot.appendChild(await renderItemRow(rowData));
        }

        // Add hint if no items
        if (!((block.items || []).length)) {
            const hint = document.createElement('div');
            hint.className = 'tl-hint';
            hint.textContent = 'Drag items or folders of items here';
            itemsRoot.appendChild(hint);
        }
    }
}
