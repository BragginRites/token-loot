'use strict';

const GENERIC_PROPERTIES = [
    { key: 'name',   label: 'Name',        path: 'name',      valueType: 'text' },
    { key: 'type',   label: 'Actor Type',  path: 'type',      valueType: 'text' },
    { key: 'custom', label: 'Custom Path', path: '__custom',  valueType: 'text' }
];

const OPERATORS = {
    text:    ['contains', '=', '!='],
    number:  ['=', '!=', '>', '<', '>=', '<=', 'between'],
    boolean: ['='],
    enum:    ['=', '!=']
};

/** Ascending creature size (tiny → gargantuan) for common Foundry keys */
const ACTOR_SIZE_RANK = new Map([
    ['tiny', 0], ['sm', 1], ['med', 2], ['lg', 3], ['huge', 4], ['grg', 5], ['grt', 5]
]);

function _rankActorSizeValue(value) {
    const k = String(value || '').toLowerCase();
    if (ACTOR_SIZE_RANK.has(k)) return ACTOR_SIZE_RANK.get(k);
    return 50;
}

function _sortActorSizeOptions(options) {
    return [...options].sort((a, b) => {
        const ra = _rankActorSizeValue(a.value);
        const rb = _rankActorSizeValue(b.value);
        if (ra !== rb) return ra - rb;
        return String(a.label).localeCompare(String(b.label));
    });
}

/**
 * Get Smart Filter property definitions from the active system adapter.
 */
export function getFilterProperties(adapter = _activeAdapter()) {
    const properties = adapter?.getFilterProperties?.();
    return Array.isArray(properties) && properties.length ? properties : GENERIC_PROPERTIES;
}

/**
 * Get the available operators for a given value type.
 */
export function getOperatorsForType(valueType) {
    return OPERATORS[valueType] || OPERATORS.text;
}

/**
 * Determine whether a filter has enough data to be evaluated safely.
 * Incomplete rules fail closed so draft UI rows never match every actor.
 * @param {object} filter
 * @returns {boolean}
 */
export function isFilterComplete(filter, properties = getFilterProperties()) {
    if (!filter?.property || !filter?.operator) return false;

    const prop = properties.find(p => p.key === filter.property);
    if (!prop) return false;
    const valueType = prop?.valueType || 'text';

    if (filter.property === 'custom' && !String(filter.customPath ?? '').trim()) return false;

    if (valueType === 'boolean') {
        return filter.value === true || filter.value === false || filter.value === 'true' || filter.value === 'false';
    }

    if (valueType === 'number') {
        if (filter.operator === 'between') {
            return _isNumeric(filter.value) && _isNumeric(filter.value2);
        }
        return _isNumeric(filter.value);
    }

    return String(filter.value ?? '').trim().length > 0;
}

/**
 * Resolve enum options for a property from the active system adapter.
 * Returns an array of { value, label } sorted by label (actor sizes: tiny → gargantuan).
 * @param {object|string} propertyOrConfigPath
 * @returns {{ value: string, label: string }[]}
 */
export function getEnumOptions(propertyOrConfigPath) {
    const property = typeof propertyOrConfigPath === 'string'
        ? { configPath: propertyOrConfigPath }
        : propertyOrConfigPath;
    if (!property) return [];

    const adapter = _activeAdapter();
    if (adapter?.getFilterEnumOptions) {
        const options = adapter.getFilterEnumOptions(property);
        if (Array.isArray(options)) {
            return property.key === 'size' ? _sortActorSizeOptions(options) : options;
        }
    }

    const configPath = property.configPath;
    if (!configPath) {
        const raw = property.options || [];
        return property.key === 'size' ? _sortActorSizeOptions(raw) : raw;
    }

    try {
        const config = typeof CONFIG !== 'undefined' ? CONFIG : {};
        const dict = _getProperty(config, configPath);
        if (!dict || typeof dict !== 'object') {
            const raw = property.options || [];
            return property.key === 'size' ? _sortActorSizeOptions(raw) : raw;
        }

        const opts = Object.entries(dict).map(([key, val]) => {
            let label;
            if (typeof val === 'string') {
                label = _localize(val);
            } else if (val?.label) {
                label = _localize(val.label);
            } else {
                label = key;
            }
            return { value: key, label };
        });
        if (property.key === 'size') return _sortActorSizeOptions(opts);
        return opts.sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
        console.warn('token-loot | Failed to resolve CONFIG path:', configPath, e);
        return property.options || [];
    }
}

/**
 * Resolve a property value from an actor, handling special keys.
 */
function resolveValue(actor, filter, properties = getFilterProperties()) {
    const prop = properties.find(p => p.key === filter.property);
    const path = prop?.path || filter.customPath || filter.property;

    // Special: spellcaster check
    if (path === '__special_spellcaster') {
        // Check if the actor has any spell items or spellcasting attribute
        let hasSpells = false;
        const items = actor.items ?? actor._source?.items ?? [];
        
        if (typeof items.values === 'function') {
            // It's a Map/Collection
            hasSpells = Array.from(items.values()).some(i => i.type === 'spell');
        } else if (Array.isArray(items)) {
            // It's a raw Array
            hasSpells = items.some(i => i.type === 'spell');
        }

        const spellAttr = _getProperty(actor, 'system.attributes.spellcasting');
        const hasSpellcastingAttr = typeof spellAttr === 'string' && spellAttr.length > 0;
        const hasSpellLevel = _getProperty(actor, 'system.details.spellLevel') ||
                              _getProperty(actor, 'system.attributes.spell.level');

        return hasSpells || hasSpellcastingAttr || !!hasSpellLevel;
    }

    // Special: custom path
    if (path === '__custom') {
        return _getProperty(actor, filter.customPath || '');
    }

    return _getProperty(actor, path);
}

/**
 * Evaluate a single filter against an actor.
 * @param {object} actor - The actor document or data object.
 * @param {object} filter - { property, operator, value, value2?, customPath? }
 * @returns {boolean}
 */
export function evaluateFilter(actor, filter, properties = getFilterProperties()) {
    if (!isFilterComplete(filter, properties)) return false;

    const raw = resolveValue(actor, filter, properties);
    const op = filter.operator;

    const prop = properties.find(p => p.key === filter.property);
    const valueType = prop?.valueType || 'text';

    if (valueType === 'boolean') {
        const boolVal = !!raw;
        const target = filter.value === 'true' || filter.value === true;
        return op === '=' ? boolVal === target : boolVal !== target;
    }

    if (valueType === 'number') {
        const numActor = parseFloat(raw);
        const numTarget = parseFloat(filter.value);
        if (isNaN(numActor)) return false;

        switch (op) {
            case '=':       return numActor === numTarget;
            case '!=':      return numActor !== numTarget;
            case '>':       return numActor > numTarget;
            case '<':       return numActor < numTarget;
            case '>=':      return numActor >= numTarget;
            case '<=':      return numActor <= numTarget;
            case 'between': {
                const lo = parseFloat(filter.value);
                const hi = parseFloat(filter.value2);
                if (isNaN(lo) || isNaN(hi)) return false;
                return numActor >= lo && numActor <= hi;
            }
            default: return false;
        }
    }

    // Enum comparisons — exact key match (case-insensitive)
    if (valueType === 'enum') {
        const strActor = String(raw ?? '').toLowerCase();
        const strTarget = String(filter.value ?? '').toLowerCase();
        return op === '=' ? strActor === strTarget : strActor !== strTarget;
    }

    // Text comparisons
    const strActor = String(raw ?? '').toLowerCase();
    const strTarget = String(filter.value ?? '').toLowerCase();

    switch (op) {
        case 'contains': return strActor.includes(strTarget);
        case '=':        return strActor === strTarget;
        case '!=':       return strActor !== strTarget;
        default:         return false;
    }
}

/**
 * Grouping key for evaluateAllFilters: same key is OR, different keys are AND.
 * Custom path filters use the path so multiple different paths are AND.
 */
export function filterGroupKey(f) {
    const p = f?.property || '_';
    if (p === 'custom' && String(f.customPath ?? '').trim()) {
        return `custom::${String(f.customPath).trim()}`;
    }
    return p;
}

/**
 * Evaluate ALL filters for a group against an actor.
 * Same property key is OR (any matching row); different properties are AND.
 * @param {object} actor
 * @param {object[]} filters
 * @returns {boolean}
 */
export function evaluateAllFilters(actor, filters, properties = getFilterProperties()) {
    if (!filters || filters.length === 0) return false;
    const complete = filters.filter(f => isFilterComplete(f, properties));
    if (complete.length === 0) return false;

    const byProp = new Map();
    for (const f of complete) {
        const key = filterGroupKey(f);
        if (!byProp.has(key)) byProp.set(key, []);
        byProp.get(key).push(f);
    }

    for (const [, groupFilters] of byProp) {
        if (!groupFilters.some(f => evaluateFilter(actor, f, properties))) return false;
    }
    return true;
}

function _isNumeric(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    return !Number.isNaN(Number(value));
}

function _activeAdapter() {
    return typeof game !== 'undefined' ? game.tokenLoot?.adapter : null;
}

function _getProperty(source, path) {
    if (!source || !path) return undefined;
    if (typeof foundry !== 'undefined' && foundry.utils?.getProperty) {
        return foundry.utils.getProperty(source, path);
    }
    return String(path).split('.').reduce((obj, part) => obj?.[part], source);
}

function _localize(value) {
    return typeof game !== 'undefined' ? game.i18n?.localize(value) || value : value;
}
