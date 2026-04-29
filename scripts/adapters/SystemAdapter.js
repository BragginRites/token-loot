'use strict';

/**
 * Base adapter class for system-specific logic.
 * Extending classes should override these methods as needed.
 */
export class SystemAdapter {
    constructor() {
        this.systemId = game.system.id;
    }

    /**
     * Modifies the item data to make it equipped/worn.
     * @param {object} itemData - The item data object to mutate
     */
    equipItem(itemData) {
        // Default generic behavior: set 'equipped' to true if it exists as a boolean
        if (typeof itemData.system?.equipped === 'boolean') {
            itemData.system.equipped = true;
        }
    }

    /**
     * Create a scroll from a spell item.
     * @param {Item} item - The source spell item
     * @returns {Promise<object|null>} The scroll item data or null if not supported
     */
    async createScroll(item) {
        return null; // Default: system does not support automatic scroll creation
    }

    /**
     * Apply currency changes to an actor.
     * @param {Actor} actor
     * @param {object} currencyPayload - e.g. { gp: 10, sp: 5 }
     */
    async addCurrency(actor, currencyPayload) {
        // Default fallback logic, assumes actor.system.currency object structure
        const updates = { system: { currency: foundry.utils.deepClone(actor.system.currency ?? {}) } };
        let hasUpdates = false;

        for (const [key, value] of Object.entries(currencyPayload)) {
            if (updates.system.currency[key] !== undefined) {
                updates.system.currency[key] = (updates.system.currency[key] ?? 0) + (value ?? 0);
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            await actor.update(updates);
        }
    }

    /**
     * Get the currency configuration for the current system.
     * @returns {object} Key-label pairs for currency (e.g., { gp: 'GP', sp: 'SP' })
     */
    getCurrencyConfiguration() {
        return {
            pp: 'PP',
            gp: 'GP',
            ep: 'EP',
            sp: 'SP',
            cp: 'CP'
        };
    }

    /**
     * Get Smart Filter properties supported by this system.
     * @returns {Array<object>}
     */
    getFilterProperties() {
        return [
            { key: 'name', label: 'Name', path: 'name', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'type', label: 'Actor Type', path: 'type', valueType: 'text', uiControl: 'text', textOp: 'contains', uiGroup: 'identity' },
            { key: 'custom', label: 'Custom Path', path: '__custom', valueType: 'text', uiControl: 'custom', uiGroup: 'advanced' }
        ];
    }

    /**
     * Resolve enum options for a Smart Filter property.
     * @param {object} property
     * @returns {{ value: string, label: string }[]}
     */
    getFilterEnumOptions(property) {
        if (!property?.configPath) return property?.options || [];

        try {
            const dict = foundry.utils.getProperty(CONFIG, property.configPath);
            if (!dict || typeof dict !== 'object') return property.options || [];

            return Object.entries(dict).map(([key, val]) => {
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
            console.warn(`${this.systemId} | Failed to resolve filter options`, property.configPath, e);
            return property.options || [];
        }
    }
}
