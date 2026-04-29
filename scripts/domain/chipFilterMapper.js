'use strict';

/**
 * Classify saved filters into chip-representable vs legacy (manual / unsupported).
 */
export function partitionManagedAndLegacyFilters(filters, properties) {
    const managed = [];
    const legacy = [];
    const warnings = [];

    for (const f of filters || []) {
        const prop = properties.find(p => p.key === f?.property);
        if (!prop) {
            legacy.push(f);
            warnings.push(`Unknown filter field "${f?.property ?? ''}" — edit or remove in raw data if needed.`);
            continue;
        }

        const ui = prop.uiControl || _inferUiControl(prop);
        if (ui === 'custom') {
            if (f.property === 'custom' && String(f.customPath ?? '').trim() && String(f.value ?? '').trim()) {
                managed.push(f);
            } else {
                legacy.push(f);
                warnings.push('Incomplete custom path filter — finish or remove.');
            }
            continue;
        }

        if (!f.operator) {
            legacy.push(f);
            continue;
        }

        if (ui === 'toggle') {
            if (f.operator === '=' && (f.value === true || f.value === false || f.value === 'true' || f.value === 'false')) {
                managed.push(f);
            } else {
                legacy.push(f);
                warnings.push(`${prop.label}: only yes/no is supported in the Smart Filter panel.`);
            }
            continue;
        }

        if (ui === 'text') {
            const allowedOp = prop.textOp || 'contains';
            if (f.operator === allowedOp || (allowedOp === 'contains' && f.operator === '=')) {
                if (String(f.value ?? '').trim()) managed.push(f);
                else legacy.push(f);
            } else {
                legacy.push(f);
                warnings.push(`${prop.label}: this operator is not available in the panel — filter kept but not shown.`);
            }
            continue;
        }

        if (ui === 'chips') {
            if (f.operator === '=' && String(f.value ?? '').trim()) {
                managed.push(f);
            } else if (f.operator === '!=') {
                legacy.push(f);
                warnings.push(`${prop.label}: "not equal" rules are not shown in the panel — filter still applies.`);
            } else {
                legacy.push(f);
                warnings.push(`${prop.label}: unsupported operator for chips — filter still applies.`);
            }
            continue;
        }

        if (ui === 'range') {
            if (f.operator === 'between' && _isNumeric(f.value) && _isNumeric(f.value2)) {
                managed.push(f);
            } else if (f.operator === '=' && _isNumeric(f.value)) {
                managed.push({ ...f, operator: 'between', value: f.value, value2: f.value });
            } else if ((f.operator === '>=' || f.operator === '<=') && _isNumeric(f.value)) {
                managed.push(f);
            } else {
                legacy.push(f);
                warnings.push(`${prop.label}: use min and/or max in the panel — this numeric rule still applies.`);
            }
            continue;
        }

        legacy.push(f);
    }

    return { managed, legacy, warnings };
}

/**
 * Build canonical filter rows from chip/range/text/toggle UI state (managed only).
 */
export function buildManagedFiltersFromState(state, properties) {
    const filters = [];
    const propsByKey = Object.fromEntries((properties || []).map(p => [p.key, p]));

    for (const [key, values] of Object.entries(state.enums || {})) {
        const prop = propsByKey[key];
        if (!prop || (prop.uiControl || _inferUiControl(prop)) !== 'chips') continue;
        for (const v of values || []) {
            if (String(v ?? '').trim()) filters.push({ property: key, operator: '=', value: String(v) });
        }
    }

    for (const [key, range] of Object.entries(state.ranges || {})) {
        const prop = propsByKey[key];
        if (!prop || (prop.uiControl || _inferUiControl(prop)) !== 'range') continue;
        const min = range.min;
        const max = range.max;
        const hasMin = _isNumeric(min);
        const hasMax = _isNumeric(max);
        if (hasMin && hasMax) {
            const lo = Math.min(Number(min), Number(max));
            const hi = Math.max(Number(min), Number(max));
            filters.push({ property: key, operator: 'between', value: String(lo), value2: String(hi) });
        } else if (hasMin) {
            filters.push({ property: key, operator: '>=', value: String(min) });
        } else if (hasMax) {
            filters.push({ property: key, operator: '<=', value: String(max) });
        }
    }

    for (const [key, val] of Object.entries(state.toggles || {})) {
        const prop = propsByKey[key];
        if (!prop || (prop.uiControl || _inferUiControl(prop)) !== 'toggle') continue;
        if (val === true || val === 'true') filters.push({ property: key, operator: '=', value: 'true' });
        else if (val === false || val === 'false') filters.push({ property: key, operator: '=', value: 'false' });
    }

    for (const [key, val] of Object.entries(state.texts || {})) {
        const prop = propsByKey[key];
        if (!prop || (prop.uiControl || _inferUiControl(prop)) !== 'text') continue;
        const s = String(val ?? '').trim();
        if (!s) continue;
        const op = prop.textOp || 'contains';
        filters.push({ property: key, operator: op, value: s });
    }

    for (const row of state.customRows || []) {
        const path = String(row?.path ?? '').trim();
        const val = String(row?.value ?? '').trim();
        if (!path || !val) continue;
        filters.push({
            property: 'custom',
            operator: 'contains',
            value: val,
            customPath: path
        });
    }

    return filters;
}

/**
 * Derive UI state from managed filters (for initial panel population).
 */
export function managedFiltersToState(managed, properties) {
    const state = {
        enums: {},
        ranges: {},
        toggles: {},
        texts: {},
        customRows: []
    };

    const propsByKey = Object.fromEntries((properties || []).map(p => [p.key, p]));

    for (const f of managed || []) {
        const prop = propsByKey[f.property];
        if (!prop) continue;
        const ui = prop.uiControl || _inferUiControl(prop);

        if (ui === 'chips' && f.operator === '=') {
            if (!state.enums[f.property]) state.enums[f.property] = [];
            state.enums[f.property].push(String(f.value));
            continue;
        }

        if (ui === 'range' && f.operator === 'between' && _isNumeric(f.value) && _isNumeric(f.value2)) {
            state.ranges[f.property] = {
                min: Number(f.value),
                max: Number(f.value2)
            };
            continue;
        }

        if (ui === 'range' && f.operator === '>=' && _isNumeric(f.value)) {
            const cur = state.ranges[f.property] || {};
            state.ranges[f.property] = { ...cur, min: Number(f.value) };
            continue;
        }

        if (ui === 'range' && f.operator === '<=' && _isNumeric(f.value)) {
            const cur = state.ranges[f.property] || {};
            state.ranges[f.property] = { ...cur, max: Number(f.value) };
            continue;
        }

        if (ui === 'toggle' && f.operator === '=') {
            if (f.value === true || f.value === 'true') state.toggles[f.property] = true;
            else if (f.value === false || f.value === 'false') state.toggles[f.property] = false;
            continue;
        }

        if (ui === 'text') {
            state.texts[f.property] = String(f.value ?? '');
            continue;
        }

        if (ui === 'custom' && f.property === 'custom') {
            state.customRows.push({
                path: f.customPath || '',
                value: String(f.value ?? '')
            });
            continue;
        }
    }

    return state;
}

function _inferUiControl(prop) {
    if (prop.valueType === 'boolean') return 'toggle';
    if (prop.valueType === 'enum' || (prop.configPath || prop.options)) return 'chips';
    if (prop.valueType === 'number') return 'range';
    if (prop.key === 'custom') return 'custom';
    return 'text';
}

function _isNumeric(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    return !Number.isNaN(Number(value));
}
