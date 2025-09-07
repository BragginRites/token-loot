'use strict';

import { renderGroupCard } from '../components/GroupCard.js';
import { bindCurrencyForm } from '../components/CurrencyForm.js';
import { ActorEventHandlers } from '../handlers/ActorEventHandlers.js';
import { BlockRenderer } from './BlockRenderer.js';
import { getCollapsedState, saveCollapsedState } from '../services/CollapseManager.js';
import { uniqueGroupId } from '../../../utils/GroupUtils.js';
import { slugify } from '../../../utils/settings.js';

/**
 * Handles rendering of individual groups with all their components
 */
export class GroupRenderer {
    
    /**
     * Render a single group with all its components and event handlers
     * @param {Object} group - The group data
     * @param {Function} renderGroups - Function to re-render all groups
     * @param {Object} autoSave - AutoSave manager instance
     * @param {Object} state - GroupManagerState instance
     * @returns {Promise<HTMLElement>} The rendered group card element
     */
    static async renderSingleGroup(group, renderGroups, autoSave, state) {
        const card = await renderGroupCard(group);

        // Set up group title editing
        this.setupGroupTitle(card, group, autoSave);

        // Set up currency form
        this.setupCurrencyForm(card, group, autoSave);

        // Set up actors area
        await this.setupActorsArea(card, group, renderGroups, autoSave);

        // Set up distribution blocks
        await this.setupDistributionBlocks(card, group, renderGroups, autoSave);

        // Set up add block button
        this.setupAddBlockButton(card, group, renderGroups, autoSave);

        // Set up group actions (clear, duplicate, delete)
        this.setupGroupActions(card, group, renderGroups, autoSave, state);

        // Set up collapse functionality
        this.setupCollapseStates(card, group);
        this.setupCollapseBehavior(card, group);

        return card;
    }

    /**
     * Set up group title editing
     */
    static setupGroupTitle(card, group, autoSave) {
        card.querySelector('.tl-title')?.addEventListener('input', ev => {
            group.name = ev.currentTarget.value;
            autoSave.saveDeferred();
        });
    }

    /**
     * Set up currency form
     */
    static setupCurrencyForm(card, group, autoSave) {
        bindCurrencyForm(card, group, () => autoSave.saveDeferred());
    }

    /**
     * Set up actors area with drag-drop and chips
     */
    static async setupActorsArea(card, group, renderGroups, autoSave) {
        const actorsEl = card.querySelector('.tl-actors');
        await ActorEventHandlers.setupActorEvents(actorsEl, group, renderGroups, autoSave);
    }

    /**
     * Set up all distribution blocks for a group
     */
    static async setupDistributionBlocks(card, group, renderGroups, autoSave) {
        const blocksEl = card.querySelector('.tl-distribution-blocks');
        await BlockRenderer.renderDistributionBlocks(blocksEl, group, renderGroups, autoSave);
    }

    /**
     * Set up add block button
     */
    static setupAddBlockButton(card, group, renderGroups, autoSave) {
        const addBlockBtn = card.querySelector('.tl-add-block');
        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent section header click
                group.distributionBlocks = group.distributionBlocks || [];
                const blockId = `block-${Date.now()}`;
                group.distributionBlocks.push({ 
                    id: blockId, 
                    name: 'New Block', 
                    type: 'chance', 
                    count: 1, 
                    allowDuplicates: false, 
                    items: [] 
                });
                renderGroups();
                autoSave.save();
            });
        }
    }

    /**
     * Set up group actions (clear actors, duplicate, delete)
     */
    static setupGroupActions(card, group, renderGroups, autoSave, state) {
        // Clear all actors
        card.querySelector('.tl-clear-actors')?.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent section header click
            
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
                } catch {}
            }
            
            if (confirmed) {
                group.actorUUIDs = [];
                renderGroups();
                autoSave.save();
            }
        });

        // Duplicate group
        card.querySelector('.tl-duplicate')?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent header click
            const originalGroup = group;
            const baseTitle = `${originalGroup.name} Copy`;
            const id = uniqueGroupId(state.getRules(), slugify(baseTitle) || 'group');
            
            // Deep clone the group
            const duplicatedGroup = {
                ...structuredClone(originalGroup),
                id,
                name: baseTitle
            };
            
            // Generate new IDs for distribution blocks
            if (duplicatedGroup.distributionBlocks) {
                duplicatedGroup.distributionBlocks = duplicatedGroup.distributionBlocks.map(block => ({
                    ...block,
                    id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                }));
            }
            
            state.addGroup(id, duplicatedGroup);
            renderGroups();
            autoSave.save();
        });

        // Delete group
        card.querySelector('.tl-delete')?.addEventListener('click', async (ev) => {
            const { confirmDialog } = await import('../components/ContextMenu.js');
            const skipConfirm = !!ev.shiftKey;
            const ok = await confirmDialog('Delete Loot Group?', `Are you sure you want to delete "${group.name || group.id}"?`, { skipConfirm });
            if (!ok) return;
            state.removeGroup(group.id);
            renderGroups();
            autoSave.save();
        });
    }

    /**
     * Set up initial collapsed states
     */
    static setupCollapseStates(card, group) {
        const groupId = group.id;
        
        // Apply group collapse state
        const isGroupCollapsed = getCollapsedState(groupId, 'group');
        if (isGroupCollapsed) {
            card.classList.add('collapsed');
        }
        
        // Apply section collapse states
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
        
        // Group collapse functionality
        const cardHeader = card.querySelector('.tl-card-hdr');
        cardHeader.addEventListener('click', (e) => {
            // Don't collapse if clicking on title input or buttons
            if (e.target.closest('.tl-title') || e.target.closest('.tl-card-actions')) return;
            
            card.classList.toggle('collapsed');
            saveCollapsedState(groupId, 'group', card.classList.contains('collapsed'));
        });

        // Section collapse functionality
        const sections = card.querySelectorAll('.tl-section');
        sections.forEach(section => {
            const header = section.querySelector('.tl-section-header');
            const sectionId = section.dataset.section;
            
            header.addEventListener('click', (e) => {
                // Don't collapse if clicking on section actions
                if (e.target.closest('.tl-section-actions')) return;
                
                section.classList.toggle('collapsed');
                saveCollapsedState(groupId, sectionId, section.classList.contains('collapsed'));
            });
        });
    }
}
