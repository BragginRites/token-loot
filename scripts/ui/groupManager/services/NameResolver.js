'use strict';

/**
 * Handles resolution of UUIDs to names and images for display
 */
export class NameResolver {
    
    /**
     * Resolve names and images for all chips and items in the given root element
     * @param {HTMLElement} root - The root element to search for chips and items
     */
    static resolveNamesIn(root) {
        this.resolveChipNames(root);
        this.resolveItemNames(root);
    }

    /**
     * Resolve names and images for actor chips
     * @param {HTMLElement} root - The root element to search for chips
     */
    static resolveChipNames(root) {
        const chips = root.querySelectorAll('.tl-chip[data-uuid]');
        for (const chip of chips) {
            const uuid = chip.getAttribute('data-uuid');
            fromUuid(uuid).then(doc => {
                if (doc?.name) {
                    chip.querySelector('.tl-chip-name')?.replaceChildren(document.createTextNode(doc.name));
                }
                const img = chip.querySelector('.tl-chip-img');
                if (img && doc) {
                    const tokenImg = doc.prototypeToken?.texture?.src;
                    img.src = tokenImg || doc.img || '';
                }
            }).catch(() => {});
        }
    }

    /**
     * Resolve names and images for item rows
     * @param {HTMLElement} root - The root element to search for item rows
     */
    static resolveItemNames(root) {
        const itemRows = root.querySelectorAll('.tl-item-row[data-uuid]');
        for (const row of itemRows) {
            const uuid = row.getAttribute('data-uuid');
            const nameEl = row.querySelector('.tl-item-name');
            const iconEl = row.querySelector('.tl-item-img');
            fromUuid(uuid).then(doc => {
                if (doc?.name && nameEl) nameEl.textContent = doc.name;
                if (iconEl && doc?.img) iconEl.src = doc.img;
            }).catch(() => {});
        }
    }
}
