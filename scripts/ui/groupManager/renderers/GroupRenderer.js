'use strict';

import { renderGroupCard } from '../components/GroupCard.js';
import { bindCurrencyForm } from '../components/CurrencyForm.js';
import { ActorEventHandlers } from '../handlers/ActorEventHandlers.js';
import { BlockRenderer } from './BlockRenderer.js';
import { getCollapsedState, saveCollapsedState } from '../services/CollapseManager.js';
import { getFilterProperties, getEnumOptions } from '../../../domain/filterEngine.js';
import { partitionManagedAndLegacyFilters, buildManagedFiltersFromState, managedFiltersToState } from '../../../domain/chipFilterMapper.js';
import { explainAllGroupsForActor, explainGroupMatch } from '../../../domain/groupResolver.js';
import { resolveGroupLoot } from '../../../domain/awardService.js';

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

        this.setupGroupTools(card, state);

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

    static setupGroupTools(card, state) {
        card.querySelector('.tl-preview-group')?.addEventListener('click', ev => {
            ev.stopPropagation();
            const group = state.getGroup(card.dataset.gid);
            if (!group) return;
            this._openPreviewDialog(group, state);
        });
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

    /** Smart Filters: chips, ranges, toggles — persists `managed + legacy` filter rows */
    static setupSmartFilters(card, group, autoSave, controller) {
        const panelEl = card.querySelector('.tl-filter-panel');
        const warningsEl = card.querySelector('.tl-filter-warnings');
        const clearBtn = card.querySelector('.tl-filter-clear-panel');
        if (!panelEl) return;

        group.filters = group.filters || [];
        const properties = getFilterProperties();

        const persist = () => {
            const part = partitionManagedAndLegacyFilters(group.filters, properties);
            const state = this._readSmartFilterPanelState(panelEl, properties);
            const managed = buildManagedFiltersFromState(state, properties);
            group.filters = [...managed, ...part.legacy];
            autoSave.saveDeferred();
            controller.refreshSidebar(group.id);
            this._renderSmartFilterWarnings(warningsEl, part.warnings);
        };

        const part0 = partitionManagedAndLegacyFilters(group.filters, properties);
        const initialState = managedFiltersToState(part0.managed, properties);
        panelEl.replaceChildren();
        this._renderSmartFilterPanel(panelEl, properties, initialState);
        this._renderSmartFilterWarnings(warningsEl, part0.warnings);

        panelEl.addEventListener('click', (e) => {
            if (e.target.closest('.tl-filter-advanced-header')) {
                e.preventDefault();
                e.stopPropagation();
                const acc = e.target.closest('.tl-filter-advanced-accordion');
                const body = acc?.querySelector('.tl-filter-advanced-body');
                if (!body) return;
                body.hidden = !body.hidden;
                acc.classList.toggle('tl-filter-advanced-open', !body.hidden);
                return;
            }
            if (e.target.closest('.tl-filter-add-custom')) {
                e.preventDefault();
                e.stopPropagation();
                const host = panelEl.querySelector('.tl-filter-custom-rows');
                if (!host) return;
                host.appendChild(this._createCustomRow({ path: '', value: '' }));
                this._syncCustomRowRemoveVisibility(host);
                persist();
                return;
            }
            const rmCustom = e.target.closest('.tl-filter-custom-row-remove');
            if (rmCustom && panelEl.contains(rmCustom) && !rmCustom.classList.contains('tl-hidden')) {
                e.preventDefault();
                e.stopPropagation();
                const row = rmCustom.closest('.tl-filter-custom-row');
                const host = panelEl.querySelector('.tl-filter-custom-rows');
                if (row && host) {
                    if (host.querySelectorAll('.tl-filter-custom-row').length > 1) row.remove();
                    else {
                        row.querySelector('.tl-custom-path').value = '';
                        row.querySelector('.tl-custom-value').value = '';
                    }
                    this._syncCustomRowRemoveVisibility(host);
                }
                persist();
                return;
            }
            const pip = e.target.closest('.tl-filter-pip');
            if (pip && panelEl.contains(pip)) {
                e.stopPropagation();
                pip.classList.toggle('tl-selected');
                persist();
                return;
            }
            const seg = e.target.closest('.tl-filter-seg');
            if (seg && panelEl.contains(seg)) {
                e.stopPropagation();
                const row = seg.closest('.tl-filter-toggle-row');
                if (!row) return;
                for (const b of row.querySelectorAll('.tl-filter-seg')) b.classList.remove('tl-active');
                seg.classList.add('tl-active');
                persist();
            }
        });

        panelEl.addEventListener('input', (e) => {
            if (panelEl.contains(e.target)) persist();
        });
        panelEl.addEventListener('change', (e) => {
            if (panelEl.contains(e.target)) persist();
        });

        clearBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._clearSmartFilterPanelUi(panelEl, properties);
            const part = partitionManagedAndLegacyFilters(group.filters, properties);
            group.filters = [...part.legacy];
            autoSave.save();
            controller.refreshSidebar(group.id);
        });
    }

    static _filterSectionOrder() {
        return ['identity', 'combat', 'abilities', 'advanced'];
    }

    static _sortFilterProperties(properties) {
        const order = this._filterSectionOrder();
        return [...properties].sort((a, b) => {
            const ga = order.indexOf(a.uiGroup || 'advanced');
            const gb = order.indexOf(b.uiGroup || 'advanced');
            if (ga !== gb) return ga - gb;
            return String(a.label || '').localeCompare(String(b.label || ''));
        });
    }

    static _sectionTitle(uiGroup) {
        const keys = {
            identity: 'TOKEN_LOOT.Filter.SectionIdentity',
            combat: 'TOKEN_LOOT.Filter.SectionCombat',
            abilities: 'TOKEN_LOOT.Filter.SectionAbilities',
            advanced: 'TOKEN_LOOT.Filter.SectionAdvanced'
        };
        const k = keys[uiGroup] || keys.advanced;
        return _localize(k, uiGroup);
    }

    static _inferFilterUi(prop) {
        return prop.uiControl
            || (prop.valueType === 'boolean' ? 'toggle'
                : prop.valueType === 'enum' || prop.configPath || prop.options ? 'chips'
                    : prop.valueType === 'number' ? 'range' : 'text');
    }

    static _combatBandKeyOrder() {
        return ['cr', 'level', 'hp', 'ac', 'eac', 'kac'];
    }

    /** Identity section field order (any key omitted by the active system is skipped). */
    static _identityFieldOrder() {
        return ['name', 'type', 'spellcaster', 'alignment', 'size'];
    }

    static _abilitiesBandFirstRow() {
        return ['str', 'dex', 'con'];
    }

    static _abilitiesBandSecondRow() {
        return ['int', 'wis', 'cha'];
    }

    static _compactStatLabel(key) {
        const m = {
            cr: 'CR', level: 'Lvl', hp: 'HP', ac: 'AC', eac: 'EAC', kac: 'KAC',
            str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA'
        };
        return m[key] || String(key || '').toUpperCase().slice(0, 4);
    }

    static _appendRangeInner(wrap, prop, state, compact) {
        const b = prop.uiBounds || { min: 0, max: 99, step: 1 };
        const r = state.ranges?.[prop.key];
        const rangeHint = _localize('TOKEN_LOOT.Filter.RangeHint', 'Leave both empty to skip. Left = minimum, right = maximum (either or both).');

        const row = document.createElement('div');
        row.className = compact ? 'tl-filter-range-row tl-filter-range-row-compact' : 'tl-filter-range-row';
        row.title = rangeHint;

        const nums = document.createElement('div');
        nums.className = 'tl-filter-range-numbers';
        const minIn = document.createElement('input');
        minIn.type = 'number';
        minIn.className = 'tl-range-min';
        minIn.min = String(b.min);
        minIn.max = String(b.max);
        minIn.step = String(b.step ?? 1);
        minIn.title = rangeHint;
        minIn.value = GroupRenderer._isNumericBound(r?.min) ? String(r.min) : '';
        const sep = document.createElement('span');
        sep.className = 'tl-filter-range-sep';
        sep.textContent = '–';
        const maxIn = document.createElement('input');
        maxIn.type = 'number';
        maxIn.className = 'tl-range-max';
        maxIn.min = String(b.min);
        maxIn.max = String(b.max);
        maxIn.step = String(b.step ?? 1);
        maxIn.title = rangeHint;
        maxIn.value = GroupRenderer._isNumericBound(r?.max) ? String(r.max) : '';
        nums.appendChild(minIn);
        nums.appendChild(sep);
        nums.appendChild(maxIn);
        row.appendChild(nums);
        wrap.appendChild(row);
    }

    static _isNumericBound(value) {
        if (value === null || value === undefined || String(value).trim() === '') return false;
        return !Number.isNaN(Number(value));
    }

    static _createCompactRangeField(prop, state) {
        const wrap = document.createElement('div');
        wrap.className = 'tl-filter-field tl-filter-field-compact';
        wrap.dataset.tlProp = prop.key;
        wrap.dataset.tlUi = 'range';
        const lab = document.createElement('div');
        lab.className = 'tl-filter-field-label tl-filter-field-label-compact';
        lab.textContent = this._compactStatLabel(prop.key);
        lab.title = `${prop.label || prop.key}. ${_localize('TOKEN_LOOT.Filter.RangeHint', 'Leave both empty to skip. Left = minimum, right = maximum (either or both).')}`;
        wrap.appendChild(lab);
        this._appendRangeInner(wrap, prop, state, true);
        return wrap;
    }

    static _createFilterField(prop, state) {
        const ui = this._inferFilterUi(prop);
        const wrap = document.createElement('div');
        wrap.className = 'tl-filter-field';
        wrap.dataset.tlProp = prop.key;
        wrap.dataset.tlUi = ui;

        const lab = document.createElement('div');
        lab.className = 'tl-filter-field-label';
        lab.textContent = prop.label || prop.key;
        wrap.appendChild(lab);

        if (ui === 'chips') {
            const pips = document.createElement('div');
            pips.className = 'tl-filter-pips';
            const selected = new Set(state.enums?.[prop.key] || []);
            for (const opt of getEnumOptions(prop)) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tl-filter-pip';
                btn.dataset.value = opt.value;
                btn.textContent = opt.label;
                if (selected.has(String(opt.value))) btn.classList.add('tl-selected');
                pips.appendChild(btn);
            }
            wrap.appendChild(pips);
        } else if (ui === 'range') {
            lab.title = `${prop.label || prop.key}. ${_localize('TOKEN_LOOT.Filter.RangeHint', 'Leave both empty to skip. Left = minimum, right = maximum (either or both).')}`;
            this._appendRangeInner(wrap, prop, state, false);
        } else if (ui === 'toggle') {
            const row = document.createElement('div');
            row.className = 'tl-filter-toggle-row';
            row.dataset.tlProp = prop.key;
            const tv = state.toggles?.[prop.key];
            const cur = tv === true || tv === 'true' ? 'true' : tv === false || tv === 'false' ? 'false' : '';
            const mk = (val, label) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tl-filter-seg';
                btn.dataset.value = val;
                btn.textContent = label;
                if (String(cur) === String(val)) btn.classList.add('tl-active');
                return btn;
            };
            row.appendChild(mk('', _localize('TOKEN_LOOT.Filter.ToggleAny', 'Any')));
            row.appendChild(mk('true', _localize('TOKEN_LOOT.Filter.BooleanYes', 'Yes')));
            row.appendChild(mk('false', _localize('TOKEN_LOOT.Filter.BooleanNo', 'No')));
            wrap.appendChild(row);
        } else if (ui === 'text') {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'tl-filter-text';
            inp.placeholder = prop.key === 'name'
                ? _localize('TOKEN_LOOT.Filter.NameContainsPlaceholder', 'Contains…')
                : _localize('TOKEN_LOOT.Filter.ValuePlaceholder', 'Value...');
            inp.value = state.texts?.[prop.key] || '';
            wrap.appendChild(inp);
        }

        return wrap;
    }

    static _shouldOpenAdvancedAccordion(state, props) {
        const rows = state.customRows || [];
        if (rows.some(r => String(r.path || '').trim() && String(r.value || '').trim())) return true;
        return (props || []).some(p => p.key !== 'custom');
    }

    static _createAdvancedAccordion(open) {
        const root = document.createElement('div');
        root.className = 'tl-filter-advanced-accordion';
        if (open) root.classList.add('tl-filter-advanced-open');

        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'tl-filter-advanced-header';
        head.innerHTML = `<span class="tl-filter-advanced-chevron"><i class="fas fa-chevron-down"></i></span> <span class="tl-filter-advanced-title">${_localize('TOKEN_LOOT.Filter.AdvancedSection', 'Advanced')}</span>`;

        const body = document.createElement('div');
        body.className = 'tl-filter-advanced-body';
        body.hidden = !open;

        root.appendChild(head);
        root.appendChild(body);
        return { root, bodyEl: body };
    }

    static _createCustomRow(row) {
        const el = document.createElement('div');
        el.className = 'tl-filter-custom-row';
        const path = document.createElement('input');
        path.type = 'text';
        path.className = 'tl-custom-path';
        path.placeholder = _localize('TOKEN_LOOT.Filter.CustomPathPlaceholder', 'Document path');
        path.value = row?.path || '';
        path.autocomplete = 'off';
        const val = document.createElement('input');
        val.type = 'text';
        val.className = 'tl-custom-value';
        val.placeholder = _localize('TOKEN_LOOT.Filter.CustomContainsPlaceholder', 'Contains…');
        val.value = row?.value || '';
        val.autocomplete = 'off';
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'tl-filter-custom-row-remove';
        rm.title = _localize('TOKEN_LOOT.Filter.CustomRemoveRow', 'Remove path');
        rm.innerHTML = '<i class="fas fa-times"></i>';
        el.appendChild(path);
        el.appendChild(val);
        el.appendChild(rm);
        return el;
    }

    static _syncCustomRowRemoveVisibility(host) {
        const n = host.querySelectorAll('.tl-filter-custom-row').length;
        host.querySelectorAll('.tl-filter-custom-row-remove').forEach(btn => {
            btn.classList.toggle('tl-hidden', n <= 1);
        });
    }

    static _appendCustomPathsEditor(bodyEl, state) {
        const hint = document.createElement('div');
        hint.className = 'tl-filter-custom-intro';
        hint.textContent = _localize('TOKEN_LOOT.Filter.CustomIntro', 'Match a value on an actor using a document path (contains).');

        const host = document.createElement('div');
        host.className = 'tl-filter-custom-rows';
        const rows = (state.customRows && state.customRows.length) ? state.customRows : [{ path: '', value: '' }];
        for (const r of rows) host.appendChild(this._createCustomRow(r));
        this._syncCustomRowRemoveVisibility(host);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'tl-btn tl-btn-sm tl-filter-add-custom';
        addBtn.textContent = _localize('TOKEN_LOOT.Filter.CustomAddRow', 'Add path');

        bodyEl.appendChild(hint);
        bodyEl.appendChild(host);
        bodyEl.appendChild(addBtn);
    }

    static _readCustomRowsFromPanel(host) {
        const out = [];
        for (const row of host.querySelectorAll('.tl-filter-custom-row')) {
            const p = row.querySelector('.tl-custom-path')?.value?.trim() ?? '';
            const v = row.querySelector('.tl-custom-value')?.value?.trim() ?? '';
            out.push({ path: p, value: v });
        }
        return out;
    }

    static _renderSmartFilterPanel(panelEl, properties, state) {
        const sorted = this._sortFilterProperties(properties);
        const byGroup = new Map();
        for (const p of sorted) {
            const g = p.uiGroup || 'advanced';
            if (!byGroup.has(g)) byGroup.set(g, []);
            byGroup.get(g).push(p);
        }

        for (const g of this._filterSectionOrder()) {
            const props = byGroup.get(g);
            if (!props?.length) continue;

            if (g === 'advanced') {
                const open = this._shouldOpenAdvancedAccordion(state, props);
                const { root, bodyEl } = this._createAdvancedAccordion(open);
                panelEl.appendChild(root);
                for (const prop of props) {
                    if (prop.key === 'custom') this._appendCustomPathsEditor(bodyEl, state);
                    else bodyEl.appendChild(this._createFilterField(prop, state));
                }
                continue;
            }

            const h = document.createElement('div');
            h.className = 'tl-filter-section-title';
            h.textContent = this._sectionTitle(g);
            panelEl.appendChild(h);

            if (g === 'identity') {
                const byKey = Object.fromEntries(props.map(p => [p.key, p]));
                const used = new Set();
                for (const key of this._identityFieldOrder()) {
                    const prop = byKey[key];
                    if (!prop) continue;
                    panelEl.appendChild(this._createFilterField(prop, state));
                    used.add(key);
                }
                const rest = props.filter(p => !used.has(p.key)).sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
                for (const prop of rest) {
                    panelEl.appendChild(this._createFilterField(prop, state));
                }
            } else if (g === 'abilities') {
                const byKey = Object.fromEntries(props.map(p => [p.key, p]));
                const appendBand = (keys) => {
                    const band = document.createElement('div');
                    band.className = 'tl-filter-band tl-filter-abilities-band';
                    for (const key of keys) {
                        const prop = byKey[key];
                        if (!prop || this._inferFilterUi(prop) !== 'range') continue;
                        band.appendChild(this._createCompactRangeField(prop, state));
                    }
                    if (band.childElementCount) panelEl.appendChild(band);
                };
                appendBand(this._abilitiesBandFirstRow());
                appendBand(this._abilitiesBandSecondRow());
            } else if (g === 'combat') {
                const band = document.createElement('div');
                band.className = 'tl-filter-band tl-filter-combat-band';
                const byKey = Object.fromEntries(props.map(p => [p.key, p]));
                const used = new Set();
                for (const key of this._combatBandKeyOrder()) {
                    const prop = byKey[key];
                    if (!prop || this._inferFilterUi(prop) !== 'range') continue;
                    band.appendChild(this._createCompactRangeField(prop, state));
                    used.add(key);
                }
                if (band.childElementCount) panelEl.appendChild(band);
                for (const prop of props) {
                    if (used.has(prop.key)) continue;
                    panelEl.appendChild(this._createFilterField(prop, state));
                }
            }
        }
    }

    static _readSmartFilterPanelState(panelEl, properties) {
        const state = { enums: {}, ranges: {}, toggles: {}, texts: {}, customRows: [] };
        for (const prop of properties) {
            if (prop.key === 'custom') continue;
            const ui = this._inferFilterUi(prop);
            const wrap = panelEl.querySelector(`[data-tl-prop="${prop.key}"]`);
            if (!wrap) continue;

            if (ui === 'chips') {
                const vals = [...wrap.querySelectorAll('.tl-filter-pip.tl-selected')].map(el => el.dataset.value).filter(Boolean);
                if (vals.length) state.enums[prop.key] = vals;
            } else if (ui === 'range') {
                const minIn = wrap.querySelector('.tl-range-min');
                const maxIn = wrap.querySelector('.tl-range-max');
                const minS = minIn?.value?.trim() ?? '';
                const maxS = maxIn?.value?.trim() ?? '';
                const hasMin = this._isNumericBound(minS);
                const hasMax = this._isNumericBound(maxS);
                if (hasMin || hasMax) {
                    state.ranges[prop.key] = {
                        ...(hasMin ? { min: minS } : {}),
                        ...(hasMax ? { max: maxS } : {})
                    };
                }
            } else if (ui === 'toggle') {
                const row = wrap.querySelector('.tl-filter-toggle-row');
                const act = row?.querySelector('.tl-filter-seg.tl-active');
                const v = act?.dataset?.value;
                if (v === 'true') state.toggles[prop.key] = true;
                else if (v === 'false') state.toggles[prop.key] = false;
            } else if (ui === 'text') {
                const t = wrap.querySelector('.tl-filter-text')?.value?.trim();
                if (t) state.texts[prop.key] = t;
            }
        }
        const customHost = panelEl.querySelector('.tl-filter-custom-rows');
        if (customHost) state.customRows = this._readCustomRowsFromPanel(customHost);
        return state;
    }

    static _clearSmartFilterPanelUi(panelEl, properties) {
        for (const prop of properties) {
            if (prop.key === 'custom') continue;
            const wrap = panelEl.querySelector(`[data-tl-prop="${prop.key}"]`);
            if (!wrap) continue;
            const ui = this._inferFilterUi(prop);
            if (ui === 'chips') wrap.querySelectorAll('.tl-filter-pip.tl-selected').forEach(p => p.classList.remove('tl-selected'));
            else if (ui === 'range') {
                const minIn = wrap.querySelector('.tl-range-min');
                const maxIn = wrap.querySelector('.tl-range-max');
                if (minIn) minIn.value = '';
                if (maxIn) maxIn.value = '';
            } else if (ui === 'toggle') {
                wrap.querySelectorAll('.tl-filter-seg').forEach((b, i) => {
                    b.classList.toggle('tl-active', i === 0);
                });
            } else if (ui === 'text') {
                const inp = wrap.querySelector('.tl-filter-text');
                if (inp) inp.value = '';
            }
        }
        const host = panelEl.querySelector('.tl-filter-custom-rows');
        if (host) {
            host.replaceChildren();
            host.appendChild(this._createCustomRow({ path: '', value: '' }));
            this._syncCustomRowRemoveVisibility(host);
        }
    }

    static _renderSmartFilterWarnings(warningsEl, warnings) {
        if (!warningsEl) return;
        warningsEl.replaceChildren();
        if (!warnings?.length) {
            warningsEl.classList.add('tl-hidden');
            return;
        }
        warningsEl.classList.remove('tl-hidden');
        for (const w of warnings) {
            const p = document.createElement('p');
            p.textContent = w;
            warningsEl.appendChild(p);
        }
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

    static _openPreviewDialog(group, state) {
        const actors = this._actorList();
        if (!actors.length) {
            ui.notifications?.warn(_localize('TOKEN_LOOT.Manager.PreviewNoActors', 'No actors are available to test.'));
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'tl-confirm-overlay';
        overlay.innerHTML = `
            <div class="tl-confirm-dialog tl-preview-dialog">
                <div class="tl-confirm-header">${_localize('TOKEN_LOOT.Manager.PreviewTitle', 'Test Loot Group')}</div>
                <div class="tl-confirm-body">
                    <div class="tl-preview-picker">
                        <label for="tl-preview-actor">${_localize('TOKEN_LOOT.Manager.PreviewActor', 'Actor')}</label>
                        <select id="tl-preview-actor"></select>
                        <button class="tl-confirm-btn tl-preview-run" type="button">${_localize('TOKEN_LOOT.Manager.PreviewRun', 'Preview')}</button>
                    </div>
                    <div class="tl-preview-results"></div>
                </div>
                <div class="tl-confirm-actions">
                    <button class="tl-confirm-btn tl-confirm-cancel" type="button">${_localize('TOKEN_LOOT.Dialog.Cancel', 'Cancel')}</button>
                </div>
            </div>
        `;

        const select = overlay.querySelector('#tl-preview-actor');
        for (const actor of actors) {
            const option = document.createElement('option');
            option.value = actor.uuid;
            option.textContent = actor.name;
            select.appendChild(option);
        }

        const results = overlay.querySelector('.tl-preview-results');
        const runPreview = async () => {
            const actor = actors.find(a => a.uuid === select.value);
            if (!actor) return;
            results.innerHTML = '<em>Previewing...</em>';
            results.innerHTML = await this._buildPreviewHtml(group, state, actor);
        };

        overlay.querySelector('.tl-preview-run')?.addEventListener('click', runPreview);
        overlay.querySelector('.tl-confirm-cancel')?.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
        runPreview();
    }

    static async _buildPreviewHtml(group, state, actor) {
        const allMatches = explainAllGroupsForActor(state.getRules(), actor);
        const currentMatch = explainGroupMatch(group, actor);
        const matchingNames = allMatches
            .filter(result => result.matched)
            .map(result => result.group?.name || result.group?.id || 'Unnamed Group');

        const currentReasons = currentMatch.reasons.length
            ? currentMatch.reasons.map(reason => `<li>${this._escapeHtml(reason)}</li>`).join('')
            : `<li>${this._escapeHtml(_localize('TOKEN_LOOT.Manager.PreviewNoMatch', 'This group does not match the selected actor.'))}</li>`;

        const sampleLoot = currentMatch.matched
            ? await this._sampleLootLines(group)
            : [_localize('TOKEN_LOOT.Manager.PreviewNoMatch', 'This group does not match the selected actor.')];

        return `
            <h4>${_localize('TOKEN_LOOT.Manager.PreviewMatchedGroups', 'Matching Groups')}</h4>
            <p>${matchingNames.length ? matchingNames.map(name => this._escapeHtml(name)).join(', ') : 'None'}</p>
            <h4>${_localize('TOKEN_LOOT.Manager.PreviewCurrentGroup', 'Current Group')}</h4>
            <ul>${currentReasons}</ul>
            <h4>${_localize('TOKEN_LOOT.Manager.PreviewSampleLoot', 'Sample Loot')}</h4>
            <ul>${sampleLoot.map(line => `<li>${this._escapeHtml(line)}</li>`).join('')}</ul>
        `;
    }

    static async _sampleLootLines(group) {
        const { currency, items } = await resolveGroupLoot(group);
        const lines = [];

        for (const [key, expr] of Object.entries(currency || {})) {
            if (expr) lines.push(`${key.toUpperCase()}: ${expr}`);
        }

        for (const row of items || []) {
            let name = row.uuid || 'Unknown Item';
            try {
                const doc = await fromUuid(row.uuid);
                if (doc?.name) name = doc.name;
            } catch { }
            const min = Number(row.qtyMin ?? 1);
            const max = Number(row.qtyMax ?? min);
            const qty = min === max ? `${min}x` : `${min}-${max}x`;
            lines.push(`${qty} ${name}`);
        }

        return lines.length ? lines : [_localize('TOKEN_LOOT.Manager.PreviewNoLoot', 'No sample loot selected by this preview roll.')];
    }

    static _actorList() {
        const source = game.actors?.contents || Array.from(game.actors || []);
        return [...source].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }

    static _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str ?? '');
        return div.innerHTML;
    }
}

function _localize(key, fallback) {
    return game.i18n?.has?.(key) ? game.i18n.localize(key) : fallback;
}
