'use strict';

import { renderGroupCard } from '../components/GroupCard.js';
import { bindCurrencyForm } from '../components/CurrencyForm.js';
import { ActorEventHandlers } from '../handlers/ActorEventHandlers.js';
import { BlockRenderer } from './BlockRenderer.js';
import { getCollapsedState, saveCollapsedState } from '../services/CollapseManager.js';
import { getFilterProperties, getOperatorsForType, getEnumOptions, isFilterComplete } from '../../../domain/filterEngine.js';

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
        // Ensure mode is set (backwards compat: default to 'actors')
        if (!group.mode) group.mode = 'actors';

        const card = await renderGroupCard(group);

        // Apply mode-based visibility
        this.applyModeVisibility(card, group);

        // Set up group title editing — also syncs sidebar name
        this.setupGroupTitle(card, group, autoSave, controller);

        // Set up currency form
        this.setupCurrencyForm(card, group, autoSave);

        // Set up based on mode
        if (group.mode === 'actors') {
            await this.setupActorsArea(card, group, autoSave, controller);
        } else {
            this.setupSmartFilters(card, group, autoSave, controller);
        }

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

    /** Set up static group title */
    static setupGroupTitle(card, group, autoSave, controller) {
        const titleEl = card.querySelector('.tl-title');
        if (titleEl) titleEl.textContent = group.name || 'Untitled';
    }

    /**
     * Set up currency form
     */
    static setupCurrencyForm(card, group, autoSave) {
        bindCurrencyForm(card, group, () => autoSave.saveDeferred());
    }

    /**
     * Apply mode-based visibility — show actors or filters section, set badge
     */
    static applyModeVisibility(card, group) {
        const mode = group.mode || 'actors';
        const actorsSection = card.querySelector('.tl-mode-actors');
        const filtersSection = card.querySelector('.tl-mode-filtered');
        const badge = card.querySelector('.tl-mode-badge');

        // Show/hide the correct section
        if (actorsSection) actorsSection.style.display = mode === 'actors' ? '' : 'none';
        if (filtersSection) filtersSection.style.display = mode === 'filtered' ? '' : 'none';

        // Set badge content
        if (badge) {
            if (mode === 'filtered') {
                badge.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize('TOKEN_LOOT.Card.ModeFiltered') || 'Filtered'}`;
                badge.classList.add('tl-mode-badge-filtered');
            } else {
                badge.innerHTML = `<i class="fas fa-user"></i> ${game.i18n.localize('TOKEN_LOOT.Card.ModeActors') || 'Individual Actors'}`;
                badge.classList.remove('tl-mode-badge-filtered');
            }
        }
    }

    /**
     * Set up the Smart Filters pane with chip-based rule builder
     */
    static setupSmartFilters(card, group, autoSave, controller) {
        const filtersEl = card.querySelector('.tl-filters');
        const addBtn = card.querySelector('.tl-add-filter');
        const emptyEl = card.querySelector('.tl-filter-empty');
        if (!filtersEl || !addBtn) return;

        // Initialize filters array on the group
        group.filters = group.filters || [];

        // Render existing filters
        for (const filter of group.filters) {
            this._appendFilterChip(filtersEl, filter, group, autoSave, controller);
        }
        this._syncFilterEmptyState(emptyEl, group);

        // Add filter button
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newFilter = { property: 'name', operator: 'contains', value: '', value2: '' };
            group.filters.push(newFilter);
            this._appendFilterChip(filtersEl, newFilter, group, autoSave, controller);
            this._syncFilterEmptyState(emptyEl, group);
            autoSave.save();
            controller.refreshSidebar(group.id);
        });
    }

    /**
     * Append a single filter chip to the container
     */
    static _appendFilterChip(filtersEl, filter, group, autoSave, controller) {
        const { getFilterProperties, getOperatorsForType } = _getFilterEngine();
        const properties = getFilterProperties();

        const chip = document.createElement('div');
        chip.className = 'tl-filter-chip';

        // Property select
        const propSelect = document.createElement('select');
        propSelect.className = 'tl-filter-property';
        for (const prop of properties) {
            const opt = document.createElement('option');
            opt.value = prop.key;
            opt.textContent = prop.label;
            if (prop.key === filter.property) opt.selected = true;
            propSelect.appendChild(opt);
        }

        // Operator select
        const opSelect = document.createElement('select');
        opSelect.className = 'tl-filter-operator';

        // Value container (dynamic based on operator)
        const valueContainer = document.createElement('div');
        valueContainer.style.display = 'contents';

        // Status text
        const statusEl = document.createElement('span');
        statusEl.className = 'tl-filter-status';

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tl-filter-delete';
        deleteBtn.type = 'button';
        deleteBtn.title = _localize('TOKEN_LOOT.Filter.Remove', 'Remove Filter');
        deleteBtn.setAttribute('aria-label', _localize('TOKEN_LOOT.Filter.Remove', 'Remove Filter'));
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';

        chip.appendChild(propSelect);
        chip.appendChild(opSelect);
        chip.appendChild(valueContainer);
        chip.appendChild(statusEl);
        chip.appendChild(deleteBtn);

        const refreshValidity = () => {
            const complete = isFilterComplete(filter);
            chip.classList.toggle('tl-filter-incomplete', !complete);
            statusEl.textContent = complete ? _localize('TOKEN_LOOT.Filter.StatusActive', 'Active') : _localize('TOKEN_LOOT.Filter.StatusIncomplete', 'Incomplete');
            statusEl.title = complete
                ? _localize('TOKEN_LOOT.Filter.StatusActiveTitle', 'This filter is active.')
                : _localize('TOKEN_LOOT.Filter.StatusIncompleteTitle', 'Incomplete filters do not match actors.');
        };

        // Rebuild operators and value inputs when property changes
        const rebuildOperators = () => {
            const propDef = properties.find(p => p.key === propSelect.value);
            const valueType = propDef?.valueType || 'text';
            const operators = getOperatorsForType(valueType);

            opSelect.innerHTML = '';
            for (const op of operators) {
                const opt = document.createElement('option');
                opt.value = op;
                opt.textContent = _operatorLabel(op);
                if (op === filter.operator && operators.includes(filter.operator)) opt.selected = true;
                opSelect.appendChild(opt);
            }
            // If current operator is not valid for this type, reset
            if (!operators.includes(filter.operator)) {
                filter.operator = operators[0];
                opSelect.value = operators[0];
            }
        };

        const rebuildValueInputs = () => {
            valueContainer.innerHTML = '';
            const propDef = properties.find(p => p.key === propSelect.value);
            const valueType = propDef?.valueType || 'text';
            const op = opSelect.value;

            // Custom path input
            if (propSelect.value === 'custom') {
                const pathInput = document.createElement('input');
                pathInput.className = 'tl-filter-custom-path';
                pathInput.type = 'text';
                pathInput.placeholder = 'system.details.type.value';
                pathInput.value = filter.customPath || '';
                pathInput.addEventListener('input', () => {
                    filter.customPath = pathInput.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });
                valueContainer.appendChild(pathInput);
            }

            if (valueType === 'boolean') {
                const boolSelect = document.createElement('select');
                boolSelect.className = 'tl-filter-value';
                boolSelect.innerHTML = `
                    <option value="true">${_localize('TOKEN_LOOT.Filter.BooleanYes', 'Yes')}</option>
                    <option value="false">${_localize('TOKEN_LOOT.Filter.BooleanNo', 'No')}</option>
                `;

                const defaultValue = filter.value === 'false' ? 'false' : 'true';
                boolSelect.value = defaultValue;

                // Sync data model if it's not set
                if (filter.value !== defaultValue) {
                    filter.value = defaultValue;
                    autoSave.saveDeferred();
                }

                boolSelect.addEventListener('change', () => {
                    filter.value = boolSelect.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });
                valueContainer.appendChild(boolSelect);
            } else if (valueType === 'enum' && propDef?.configPath) {
                // Schema-aware dropdown from CONFIG
                const enumSelect = document.createElement('select');
                enumSelect.className = 'tl-filter-value';
                const options = getEnumOptions(propDef.configPath);
                // Add a placeholder option
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = _localize('TOKEN_LOOT.Filter.SelectPlaceholder', 'Select...');
                placeholder.disabled = true;
                if (!filter.value) placeholder.selected = true;
                enumSelect.appendChild(placeholder);
                for (const opt of options) {
                    const el = document.createElement('option');
                    el.value = opt.value;
                    el.textContent = opt.label;
                    if (opt.value === filter.value) el.selected = true;
                    enumSelect.appendChild(el);
                }
                enumSelect.addEventListener('change', () => {
                    filter.value = enumSelect.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });
                valueContainer.appendChild(enumSelect);
            } else if (op === 'between') {
                const minInput = document.createElement('input');
                minInput.className = 'tl-filter-value-number';
                minInput.type = 'number';
                minInput.placeholder = _localize('TOKEN_LOOT.Filter.MinPlaceholder', 'Min');
                minInput.value = filter.value ?? '';
                minInput.addEventListener('input', () => {
                    filter.value = minInput.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });

                const sep = document.createElement('span');
                sep.className = 'tl-filter-between-sep';
                sep.textContent = _localize('TOKEN_LOOT.Filter.BetweenSeparator', 'and');

                const maxInput = document.createElement('input');
                maxInput.className = 'tl-filter-value-number';
                maxInput.type = 'number';
                maxInput.placeholder = _localize('TOKEN_LOOT.Filter.MaxPlaceholder', 'Max');
                maxInput.value = filter.value2 ?? '';
                maxInput.addEventListener('input', () => {
                    filter.value2 = maxInput.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });

                valueContainer.appendChild(minInput);
                valueContainer.appendChild(sep);
                valueContainer.appendChild(maxInput);
            } else if (valueType === 'number') {
                const numInput = document.createElement('input');
                numInput.className = 'tl-filter-value-number';
                numInput.type = 'number';
                numInput.placeholder = '0';
                numInput.value = filter.value ?? '';
                numInput.addEventListener('input', () => {
                    filter.value = numInput.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });
                valueContainer.appendChild(numInput);
            } else {
                const textInput = document.createElement('input');
                textInput.className = 'tl-filter-value';
                textInput.type = 'text';
                textInput.placeholder = _localize('TOKEN_LOOT.Filter.ValuePlaceholder', 'Value...');
                textInput.value = filter.value ?? '';
                textInput.addEventListener('input', () => {
                    filter.value = textInput.value;
                    refreshValidity();
                    autoSave.saveDeferred();
                });
                valueContainer.appendChild(textInput);
            }
        };

        // Wire up change handlers
        propSelect.addEventListener('change', () => {
            filter.property = propSelect.value;
            filter.value = '';
            filter.value2 = '';
            rebuildOperators();
            rebuildValueInputs();
            refreshValidity();
            autoSave.saveDeferred();
        });

        opSelect.addEventListener('change', () => {
            filter.operator = opSelect.value;
            rebuildValueInputs();
            refreshValidity();
            autoSave.saveDeferred();
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = group.filters.indexOf(filter);
            if (idx !== -1) group.filters.splice(idx, 1);
            chip.remove();
            autoSave.save();
            GroupRenderer._syncFilterEmptyState(filtersEl.closest('.tl-section-content')?.querySelector('.tl-filter-empty'), group);
            controller.refreshSidebar(group.id);
        });

        // Initial build
        rebuildOperators();
        rebuildValueInputs();
        refreshValidity();

        filtersEl.appendChild(chip);
    }

    static _syncFilterEmptyState(emptyEl, group) {
        if (!emptyEl) return;
        const hasFilters = (group.filters?.length || 0) > 0;
        emptyEl.classList.toggle('tl-hidden', hasFilters);
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
     * Set up group actions (clear actors)
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

/* ——— Module-level helpers for filter chip rendering ——— */

function _getFilterEngine() {
    return { getFilterProperties, getOperatorsForType, getEnumOptions, isFilterComplete };
}

function _operatorLabel(op) {
    const labels = {
        'contains': _localize('TOKEN_LOOT.Filter.OperatorContains', 'Contains'),
        '=':        _localize('TOKEN_LOOT.Filter.OperatorEquals', 'Equals'),
        '!=':       _localize('TOKEN_LOOT.Filter.OperatorNotEqual', 'Not Equal'),
        '>':        _localize('TOKEN_LOOT.Filter.OperatorGreaterThan', 'Greater Than'),
        '<':        _localize('TOKEN_LOOT.Filter.OperatorLessThan', 'Less Than'),
        '>=':       _localize('TOKEN_LOOT.Filter.OperatorAtLeast', 'At Least'),
        '<=':       _localize('TOKEN_LOOT.Filter.OperatorAtMost', 'At Most'),
        'between':  _localize('TOKEN_LOOT.Filter.OperatorBetween', 'Between')
    };
    return labels[op] || op;
}

function _localize(key, fallback) {
    return game.i18n?.has?.(key) ? game.i18n.localize(key) : fallback;
}
