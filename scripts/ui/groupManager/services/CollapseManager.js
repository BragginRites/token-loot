'use strict';

/**
 * Get the collapsed state for a specific section
 * @param {string} groupId - The group identifier
 * @param {string} sectionId - The section identifier  
 * @returns {boolean} True if collapsed
 */
export function getCollapsedState(groupId, sectionId) {
    const key = `tl-collapsed-${groupId}-${sectionId}`;
    return localStorage.getItem(key) === 'true';
}

/**
 * Save the collapsed state for a specific section
 * @param {string} groupId - The group identifier
 * @param {string} sectionId - The section identifier
 * @param {boolean} isCollapsed - Whether the section is collapsed
 */
export function saveCollapsedState(groupId, sectionId, isCollapsed) {
    const key = `tl-collapsed-${groupId}-${sectionId}`;
    if (isCollapsed) {
        localStorage.setItem(key, 'true');
    } else {
        localStorage.removeItem(key);
    }
}

/**
 * Collapse all groups and sections in the Group Manager
 */
export function collapseAllSections() {
    // Collapse all groups
    const groups = document.querySelectorAll('#tl-group-manager .tl-card');
    groups.forEach(group => {
        group.classList.add('collapsed');
        const groupId = group.dataset.gid;
        saveCollapsedState(groupId, 'group', true);
    });
    
    // Collapse all sections within groups
    const sections = document.querySelectorAll('#tl-group-manager .tl-section');
    sections.forEach(section => {
        section.classList.add('collapsed');
        const groupId = section.closest('.tl-card').dataset.gid;
        const sectionId = section.dataset.section;
        saveCollapsedState(groupId, sectionId, true);
    });
}
