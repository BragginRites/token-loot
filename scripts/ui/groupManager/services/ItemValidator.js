'use strict';

/**
 * Service for validating and enriching items with metadata
 */
export class ItemValidator {
    
    /**
     * Validate and enrich a single item with metadata
     * @param {Object} item - The item to validate (must have uuid property)
     * @returns {Promise<Object>} Enriched item with name, img, isValid, and __sort properties
     */
    static async validateAndEnrichItem(item) {
        let name = '';
        let img = '';
        let isValid = false;
        
        try {
            const doc = await fromUuid(item.uuid);
            if (doc) {
                name = doc.name || '';
                img = doc.img || '';
                isValid = true;
            }
        } catch {}
        
        return { 
            ...item, 
            name, 
            img, 
            isValid, 
            __sort: String(name).toLocaleLowerCase() 
        };
    }

    /**
     * Process a list of items: validate, enrich, and sort
     * @param {Array} items - Array of items to process
     * @returns {Promise<Object>} Object with validItems and invalidItems arrays
     */
    static async processItems(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return { validItems: [], invalidItems: [] };
        }

        // Validate and enrich all items
        const enrichedItems = await Promise.all(
            items.map(item => this.validateAndEnrichItem(item))
        );

        // Sort alphabetically by name
        enrichedItems.sort((a, b) => a.__sort.localeCompare(b.__sort));

        // Split into valid and invalid
        const validItems = enrichedItems.filter(item => item.isValid);
        const invalidItems = enrichedItems.filter(item => !item.isValid);

        return { validItems, invalidItems };
    }

    /**
     * Filter invalid items from a block's item array
     * @param {Array} blockItems - The block's items array
     * @param {Array} validItems - Array of valid items to keep
     * @returns {Array} Filtered items array with only valid items
     */
    static filterValidItems(blockItems, validItems) {
        if (!Array.isArray(blockItems) || !Array.isArray(validItems)) {
            return [];
        }

        return blockItems.filter(item => 
            validItems.some(valid => valid.uuid === item.uuid)
        );
    }
}
