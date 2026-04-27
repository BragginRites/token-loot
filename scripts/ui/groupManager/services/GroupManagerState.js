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

    getOrderedGroupIds() {
        this._normalizeGroupOrder();
        return [...this.rules.groupOrder];
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
        this._normalizeGroupOrder();
        if (!this.rules.groupOrder.includes(groupId)) {
            this.rules.groupOrder.push(groupId);
        }
    }

    /**
     * Remove a group
     * @param {string} groupId - The group ID to remove
     */
    removeGroup(groupId) {
        if (this.rules.groups?.[groupId]) {
            delete this.rules.groups[groupId];
        }
        this._normalizeGroupOrder();
    }

    setGroupOrder(groupIds) {
        this.rules.groupOrder = Array.isArray(groupIds) ? [...groupIds] : [];
        this._normalizeGroupOrder();
    }

    moveGroup(draggedId, targetId, position = 'before') {
        if (!draggedId || !targetId || draggedId === targetId) return false;
        const order = this.getOrderedGroupIds().filter(gid => gid !== draggedId);
        const targetIndex = order.indexOf(targetId);
        if (targetIndex === -1) return false;

        const insertAt = position === 'after' ? targetIndex + 1 : targetIndex;
        order.splice(insertAt, 0, draggedId);
        this.setGroupOrder(order);
        return true;
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
        this._normalizeGroupOrder();
    }

    _normalizeGroupOrder() {
        this.rules.groups = this.rules.groups || {};
        const groups = this.rules.groups;
        const seen = new Set();
        const normalized = [];

        for (const gid of this.rules.groupOrder || []) {
            if (!groups[gid] || seen.has(gid)) continue;
            seen.add(gid);
            normalized.push(gid);
        }

        for (const gid of Object.keys(groups)) {
            if (seen.has(gid)) continue;
            normalized.push(gid);
        }

        this.rules.groupOrder = normalized;
    }
}
