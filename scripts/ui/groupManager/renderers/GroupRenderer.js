'use strict';

import { renderGroupCard } from '../components/GroupCard.js';
import { bindCurrencyForm } from '../components/CurrencyForm.js';
import { ActorEventHandlers } from '../handlers/ActorEventHandlers.js';
import { BlockRenderer } from './BlockRenderer.js';
import { getCollapsedState, saveCollapsedState } from '../services/CollapseManager.js';
import { uniqueGroupId } from '../../../utils/GroupUtils.js';
import { slugify } from '../../../utils/StringUtils.js';

/**
 * Handles rendering of individual groups with all their components
 */
export class GroupRenderer {

    /**
     * Render a single group with all its components and event handlers
     * @param {Object} group - The group data
     * @param {Object} controller - GroupManagerController instance for incremental updates
     * @param {Object} autoSave - AutoSave manager instance
     * @param {Object} state - GroupManagerState instance
     * @returns {Promise<HTMLElement>} The rendered group card element
     */
    static async renderSingleGroup(group, controller, autoSave, state) {
        const card = await renderGroupCard(group);

        // Set up group title editing — also syncs sidebar name
        this.setupGroupTitle(card, group, autoSave, controller);

        // Set up currency form
        this.setupCurrencyForm(card, group, autoSave);

        // Set up actors area with sidebar count sync
        await this.setupActorsArea(card, group, autoSave, controller);

        // Set up distribution blocks with sidebar count sync
        await this.setupDistributionBlocks(card, group, autoSave, controller);

        // Set up add block button
        this.setupAddBlockButton(card, group, autoSave, controller);

        // Set up group actions (clear, duplicate, delete)
        this.setupGroupActions(card, group, autoSave, state, controller);

        // Set up collapse for inner sections only (not the group card itself)
        this.setupSectionCollapseStates(card, group);
        this.setupSectionCollapseBehavior(card, group);

        return card;
    }

    /**
     * Set up group title editing — syncs the sidebar item name on change
     */
    static setupGroupTitle(card, group, autoSave, controller) {
        const titleInput = card.querySelector('.tl-title');
        titleInput?.addEventListener('input', ev => {
            group.name = ev.currentTarget.value;
            autoSave.saveDeferred();
            controller.refreshSidebar(group.id);
        });
    }

    /**
     * Set up currency form
     */
    static setupCurrencyForm(card, group, autoSave) {
        bindCurrencyForm(card, group, () => autoSave.saveDeferred());
    }

    /**
     * Set up actors area with drag-drop and chips — syncs sidebar on change
     */
    static async setupActorsArea(card, group, autoSave, controller) {
        const actorsEl = card.querySelector('.tl-actors');
        // Wrap autoSave so sidebar updates on actor add/remove
        const wrappedAutoSave = {
            save: () => { autoSave.save(); controller.refreshSidebar(group.id); },
            saveDeferred: () => { autoSave.saveDeferred(); controller.refreshSidebar(group.id); }
        };
        await ActorEventHandlers.setupActorEvents(actorsEl, group, wrappedAutoSave);
    }

    /**
     * Set up all distribution blocks for a group
     */
    static async setupDistributionBlocks(card, group, autoSave, controller) {
        const blocksEl = card.querySelector('.tl-distribution-blocks');
        await BlockRenderer.renderDistributionBlocks(blocksEl, group, autoSave);
    }

    /**
     * Set up add block button — appends new block, syncs sidebar count
     */
    static setupAddBlockButton(card, group, autoSave, controller) {
        const addBlockBtn = card.querySelector('.tl-add-block');
        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                group.distributionBlocks = group.distributionBlocks || [];
                const blockId = `block-${Date.now()}`;
                const newBlock = {
                    id: blockId,
                    name: game.i18n.localize('TOKEN_LOOT.Block.NewBlock') || 'New Block',
                    type: 'chance',
                    count: 1,
                    allowDuplicates: false,
                    items: []
                };
                group.distributionBlocks.push(newBlock);

                const blocksEl = card.querySelector('.tl-distribution-blocks');
                await BlockRenderer.appendBlock(blocksEl, group, newBlock, autoSave);
                autoSave.save();
                controller.refreshSidebar(group.id);
            });
        }
    }

    /**
     * Set up group actions (clear actors, duplicate, delete)
     */
    static setupGroupActions(card, group, autoSave, state, controller) {
        // Clear all actors
        card.querySelector('.tl-clear-actors')?.addEventListener('click', async (e) => {
            e.stopPropagation();

            const skipConfirm = !!e.shiftKey;
            let confirmed = true;
            if (!skipConfirm) {
                try {
                    const { confirmDialog } = await import('../components/ContextMenu.js');
                    confirmed = await confirmDialog(
                        game.i18n.localize('TOKEN_LOOT.Card.ClearAllActorsTitle') || 'Clear All Actors',
                        game.i18n.format("TOKEN_LOOT.Dialog.ClearAllActorsPrompt", { name: group.name }),
                        { danger: true }
                    );
                } catch { }
            }

            if (confirmed) {
                group.actorUUIDs = [];
                const actorsEl = card.querySelector('.tl-actors');
                ActorEventHandlers.clearActorChips(actorsEl);
                autoSave.save();
                controller.refreshSidebar(group.id);
            }
        });

        // Duplicate group
        card.querySelector('.tl-duplicate')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const originalGroup = group;
            const baseTitle = game.i18n.format("TOKEN_LOOT.Card.DuplicateGroupTitle", { name: originalGroup.name });
            const id = uniqueGroupId(state.getRules(), slugify(baseTitle) || 'group');

            const duplicatedGroup = {
                ...structuredClone(originalGroup),
                id,
                name: baseTitle
            };

            if (duplicatedGroup.distributionBlocks) {
                duplicatedGroup.distributionBlocks = duplicatedGroup.distributionBlocks.map(block => ({
                    ...block,
                    id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                }));
            }

            state.addGroup(id, duplicatedGroup);
            await controller.appendGroupCard(id);
            autoSave.save();
        });

        // Delete group
        card.querySelector('.tl-delete')?.addEventListener('click', async (ev) => {
            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const title = game.i18n.localize('TOKEN_LOOT.Dialog.DeleteGroupTitle') || 'Delete Loot Group?';
            const prompt = game.i18n.format("TOKEN_LOOT.Dialog.DeleteGroupPrompt", { name: group.name || group.id });
            const ok = await confirmDialog(title, prompt, { skipConfirm });
            if (!ok) return;
            state.removeGroup(group.id);
            controller.removeGroupCard(group.id);
            autoSave.save();
        });
    }

    /**
     * Set up initial collapsed states for inner sections only
     */
    static setupSectionCollapseStates(card, group) {
        const groupId = group.id;

        const sections = card.querySelectorAll('.tl-section');
        sections.forEach(section => {
            const sectionId = section.dataset.section;
            const secCollapsed = getCollapsedState(groupId, sectionId);
            if (secCollapsed) section.classList.add('collapsed');
        });
    }

    /**
     * Set up collapse behavior for inner sections only
     */
    static setupSectionCollapseBehavior(card, group) {
        const groupId = group.id;

        const sections = card.querySelectorAll('.tl-section');
        sections.forEach(section => {
            const header = section.querySelector('.tl-section-header');
            const sectionId = section.dataset.section;

            header.addEventListener('click', (e) => {
                if (e.target.closest('.tl-section-actions')) return;

                section.classList.toggle('collapsed');
                saveCollapsedState(groupId, sectionId, section.classList.contains('collapsed'));
            });
        });
    }
}
