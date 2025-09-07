'use strict';

/**
 * Create a shortened display name from a UUID
 * @param {string} uuid - The UUID to shorten
 * @returns {string} A shortened version for display
 */
export function shortName(uuid) {
    try { 
        const parts = String(uuid).split('.'); 
        return parts[0] + (parts[1] ? `…${parts[1].slice(-6)}` : ''); 
    } catch { 
        return uuid; 
    }
}
