'use strict';

import { getWorldRuleSet, saveWorldRuleSet } from '../../../utils/settings.js';

/**
 * Manages the state of the Group Manager
 */
export class GroupManagerState {
    constructor() {
        this.rules = structuredClone(getWorldRuleSet());
    }

    /**
     * Get the current rules object
     * @returns {Object} The rules object
     */
    getRules() {
        return this.rules;
    }

    /**
     * Get all groups
     * @returns {Object} Groups object
     */
    getGroups() {
        return this.rules.groups || {};
    }

    /**
     * Get a specific group by ID
     * @param {string} groupId - The group ID
     * @returns {Object|undefined} The group object
     */
    getGroup(groupId) {
        return this.rules.groups?.[groupId];
    }

    /**
     * Add a new group
     * @param {string} groupId - The group ID
     * @param {Object} groupData - The group data
     */
    addGroup(groupId, groupData) {
        this.rules.groups = this.rules.groups || {};
        this.rules.groups[groupId] = groupData;
    }

    /**
     * Remove a group
     * @param {string} groupId - The group ID to remove
     */
    removeGroup(groupId) {
        if (this.rules.groups?.[groupId]) {
            delete this.rules.groups[groupId];
        }
    }

    /**
     * Update a group's property
     * @param {string} groupId - The group ID
     * @param {string} property - The property to update
     * @param {any} value - The new value
     */
    updateGroupProperty(groupId, property, value) {
        const group = this.getGroup(groupId);
        if (group) {
            group[property] = value;
        }
    }

    /**
     * Save the current state to world settings
     */
    save() {
        saveWorldRuleSet(this.rules);
    }

    /**
     * Reload state from world settings
     */
    reload() {
        this.rules = structuredClone(getWorldRuleSet());
    }
}
