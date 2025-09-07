'use strict';

/**
 * Generate a unique group ID by appending numbers if needed
 * @param {Object} rules - The rules object containing existing groups
 * @param {string} base - The base name for the group ID
 * @returns {string} A unique group ID
 */
export function uniqueGroupId(rules, base) {
    let id = base; 
    let i = 2;
    while (rules.groups[id]) { 
        id = `${base}-${i++}`; 
    }
    return id;
}
