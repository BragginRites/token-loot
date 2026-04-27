'use strict';

/**
 * Property definitions for the dnd5e system.
 * Each property has a label, a path (or special key), a valueType, and
 * optionally a configPath that points to a CONFIG dictionary for enum values.
 */
const DND5E_PROPERTIES = [
    { key: 'name',          label: 'Name',              path: 'name',                              valueType: 'text' },
    { key: 'cr',            label: 'CR / Level',        path: 'system.details.cr',                 valueType: 'number' },
    { key: 'type',          label: 'Creature Type',     path: 'system.details.type.value',         valueType: 'enum',    configPath: 'DND5E.creatureTypes' },
    { key: 'size',          label: 'Size',              path: 'system.traits.size',                valueType: 'enum',    configPath: 'DND5E.actorSizes' },
    { key: 'alignment',     label: 'Alignment',         path: 'system.details.alignment',          valueType: 'enum',    configPath: 'DND5E.alignments' },
    { key: 'str',           label: 'Strength',          path: 'system.abilities.str.value',        valueType: 'number' },
    { key: 'dex',           label: 'Dexterity',         path: 'system.abilities.dex.value',        valueType: 'number' },
    { key: 'con',           label: 'Constitution',      path: 'system.abilities.con.value',        valueType: 'number' },
    { key: 'int',           label: 'Intelligence',      path: 'system.abilities.int.value',        valueType: 'number' },
    { key: 'wis',           label: 'Wisdom',            path: 'system.abilities.wis.value',        valueType: 'number' },
    { key: 'cha',           label: 'Charisma',          path: 'system.abilities.cha.value',        valueType: 'number' },
    { key: 'hp',            label: 'Max HP',            path: 'system.attributes.hp.max',          valueType: 'number' },
    { key: 'ac',            label: 'Armor Class',       path: 'system.attributes.ac.value',        valueType: 'number' },
    { key: 'spellcaster',   label: 'Has Spellcasting',  path: '__special_spellcaster',             valueType: 'boolean' },
    { key: 'custom',        label: 'Custom Path',       path: '__custom',                          valueType: 'text' }
];

const OPERATORS = {
    text:    ['contains', '=', '!='],
    number:  ['=', '!=', '>', '<', '>=', '<=', 'between'],
    boolean: ['='],
    enum:    ['=', '!=']
};

/**
 * Get the property definitions for the current system.
 * Currently only dnd5e is implemented; others fall back to a minimal set.
 */
export function getFilterProperties() {
    // Future: switch on game.system.id for pf2e, sw5e, etc.
    return DND5E_PROPERTIES;
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
export function isFilterComplete(filter) {
    if (!filter?.property || !filter?.operator) return false;

    const prop = getFilterProperties().find(p => p.key === filter.property);
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
 * Resolve the enum options for a property from the CONFIG object.
 * Returns an array of { value, label } sorted by label.
 * @param {string} configPath - e.g. 'DND5E.creatureTypes'
 * @returns {{ value: string, label: string }[]}
 */
export function getEnumOptions(configPath) {
    if (!configPath) return [];
    try {
        const dict = foundry.utils.getProperty(CONFIG, configPath);
        if (!dict || typeof dict !== 'object') return [];

        return Object.entries(dict).map(([key, val]) => {
            // CONFIG entries can be: plain string, or object with .label
            let label;
            if (typeof val === 'string') {
                label = game.i18n?.localize(val) || val;
            } else if (val?.label) {
                label = game.i18n?.localize(val.label) || val.label;
            } else {
                label = key;
            }
            return { value: key, label };
        }).sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
        console.warn('token-loot | Failed to resolve CONFIG path:', configPath, e);
        return [];
    }
}

/**
 * Resolve a property value from an actor, handling special keys.
 */
function resolveValue(actor, filter) {
    const prop = getFilterProperties().find(p => p.key === filter.property);
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

        const spellAttr = foundry.utils.getProperty(actor, 'system.attributes.spellcasting');
        const hasSpellcastingAttr = typeof spellAttr === 'string' && spellAttr.length > 0;
        const hasSpellLevel = foundry.utils.getProperty(actor, 'system.details.spellLevel') || 
                              foundry.utils.getProperty(actor, 'system.attributes.spell.level');

        return hasSpells || hasSpellcastingAttr || !!hasSpellLevel;
    }

    // Special: custom path
    if (path === '__custom') {
        return foundry.utils.getProperty(actor, filter.customPath || '');
    }

    return foundry.utils.getProperty(actor, path);
}

/**
 * Evaluate a single filter against an actor.
 * @param {object} actor - The actor document or data object.
 * @param {object} filter - { property, operator, value, value2?, customPath? }
 * @returns {boolean}
 */
export function evaluateFilter(actor, filter) {
    if (!isFilterComplete(filter)) return false;

    const raw = resolveValue(actor, filter);
    const op = filter.operator;

    const prop = getFilterProperties().find(p => p.key === filter.property);
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
 * Evaluate ALL filters for a group against an actor.
 * All filters must match (AND logic).
 * @param {object} actor
 * @param {object[]} filters
 * @returns {boolean}
 */
export function evaluateAllFilters(actor, filters) {
    if (!filters || filters.length === 0) return false;
    return filters.every(f => evaluateFilter(actor, f));
}

function _isNumeric(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    return !Number.isNaN(Number(value));
}
