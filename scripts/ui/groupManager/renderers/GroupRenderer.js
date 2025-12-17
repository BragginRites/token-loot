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

        // Set up group title editing - no re-render needed
        this.setupGroupTitle(card, group, autoSave, controller);

        // Set up currency form - no re-render needed
        this.setupCurrencyForm(card, group, autoSave);

        // Set up actors area - incremental updates
        await this.setupActorsArea(card, group, autoSave);

        // Set up distribution blocks - incremental updates
        await this.setupDistributionBlocks(card, group, autoSave);

        // Set up add block button - incremental append
        this.setupAddBlockButton(card, group, autoSave);

        // Set up group actions (clear, duplicate, delete) - incremental
        this.setupGroupActions(card, group, autoSave, state, controller);

        // Set up collapse functionality
        this.setupCollapseStates(card, group);
        this.setupCollapseBehavior(card, group);

        return card;
    }

    /**
     * Set up group title editing
     */
    static setupGroupTitle(card, group, autoSave, controller) {
        const titleInput = card.querySelector('.tl-title');
        titleInput?.addEventListener('input', ev => {
            group.name = ev.currentTarget.value;
            autoSave.saveDeferred();
        });
        // Update search filter on blur in case name changed
        titleInput?.addEventListener('blur', () => {
            controller.applySearchFilter();
        });
    }

    /**
     * Set up currency form
     */
    static setupCurrencyForm(card, group, autoSave) {
        bindCurrencyForm(card, group, () => autoSave.saveDeferred());
    }

    /**
     * Set up actors area with drag-drop and chips - incremental
     */
    static async setupActorsArea(card, group, autoSave) {
        const actorsEl = card.querySelector('.tl-actors');
        await ActorEventHandlers.setupActorEvents(actorsEl, group, autoSave);
    }

    /**
     * Set up all distribution blocks for a group
     */
    static async setupDistributionBlocks(card, group, autoSave) {
        const blocksEl = card.querySelector('.tl-distribution-blocks');
        await BlockRenderer.renderDistributionBlocks(blocksEl, group, autoSave);
    }

    /**
     * Set up add block button - appends new block without full re-render
     */
    static setupAddBlockButton(card, group, autoSave) {
        const addBlockBtn = card.querySelector('.tl-add-block');
        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                group.distributionBlocks = group.distributionBlocks || [];
                const blockId = `block-${Date.now()}`;
                const newBlock = {
                    id: blockId,
                    name: 'New Block',
                    type: 'chance',
                    count: 1,
                    allowDuplicates: false,
                    items: []
                };
                group.distributionBlocks.push(newBlock);

                // Append just this block
                const blocksEl = card.querySelector('.tl-distribution-blocks');
                await BlockRenderer.appendBlock(blocksEl, group, newBlock, autoSave);
                autoSave.save();
            });
        }
    }

    /**
     * Set up group actions (clear actors, duplicate, delete)
     */
    static setupGroupActions(card, group, autoSave, state, controller) {
        // Clear all actors - just clears chips, no full re-render
        card.querySelector('.tl-clear-actors')?.addEventListener('click', async (e) => {
            e.stopPropagation();

            const skipConfirm = !!e.shiftKey;
            let confirmed = true;
            if (!skipConfirm) {
                try {
                    const { confirmDialog } = await import('../components/ContextMenu.js');
                    confirmed = await confirmDialog(
                        'Clear All Actors',
                        `Are you sure you want to remove all actors from "${group.name}"?`,
                        { danger: true }
                    );
                } catch { }
            }

            if (confirmed) {
                group.actorUUIDs = [];
                const actorsEl = card.querySelector('.tl-actors');
                ActorEventHandlers.clearActorChips(actorsEl);
                autoSave.save();
            }
        });

        // Duplicate group - appends new card
        card.querySelector('.tl-duplicate')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const originalGroup = group;
            const baseTitle = `${originalGroup.name} Copy`;
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

        // Delete group - removes card from DOM
        card.querySelector('.tl-delete')?.addEventListener('click', async (ev) => {
            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const ok = await confirmDialog('Delete Loot Group?', `Are you sure you want to delete "${group.name || group.id}"?`, { skipConfirm });
            if (!ok) return;
            state.removeGroup(group.id);
            controller.removeGroupCard(group.id);
            autoSave.save();
        });
    }

    /**
     * Set up initial collapsed states
     */
    static setupCollapseStates(card, group) {
        const groupId = group.id;

        const isGroupCollapsed = getCollapsedState(groupId, 'group');
        if (isGroupCollapsed) {
            card.classList.add('collapsed');
        }

        const sections = card.querySelectorAll('.tl-section');
        sections.forEach(section => {
            const sectionId = section.dataset.section;
            const secCollapsed = getCollapsedState(groupId, sectionId);
            if (secCollapsed) section.classList.add('collapsed');
        });
    }

    /**
     * Set up collapse behavior for group and sections
     */
    static setupCollapseBehavior(card, group) {
        const groupId = group.id;

        const cardHeader = card.querySelector('.tl-card-hdr');
        cardHeader.addEventListener('click', (e) => {
            if (e.target.closest('.tl-title') || e.target.closest('.tl-card-actions')) return;

            card.classList.toggle('collapsed');
            saveCollapsedState(groupId, 'group', card.classList.contains('collapsed'));
        });

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
