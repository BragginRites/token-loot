'use strict';

import { loadTemplate } from './services/TemplateLoader.js';
import { makeDraggable, makeResizable, loadSavedSize } from './services/ResizeManager.js';
import { AutoSaveManager } from './services/AutoSaveManager.js';
import { GroupManagerState } from './services/GroupManagerState.js';
import { AppEventHandlers } from './handlers/AppEventHandlers.js';
import { GroupRenderer } from './renderers/GroupRenderer.js';
import { NameResolver } from './services/NameResolver.js';
import { slugify } from '../../utils/StringUtils.js';
import { saveCollapsedState } from './services/CollapseManager.js';

/**
 * Main controller for the Group Manager UI
 * Coordinates all services, renderers, and state management
 */
export class GroupManagerController {

    constructor() {
        this.overlayId = 'tl-group-manager';
        this.state = null;
        this.autoSave = null;
        this.overlay = null;
        this.listEl = null;
        this.searchTerm = '';
    }

    /**
     * Open and initialize the Group Manager UI
     */
    async open() {
        this.closeIfOpen();
        await this.initializeUI();
        this.setupServices();
        this.setupEventHandlers();
        await this.initialRender();
    }

    /**
     * Close the Group Manager if currently open
     */
    closeIfOpen() {
        document.getElementById(this.overlayId)?.remove();
    }

    /**
     * Initialize the UI elements and DOM structure
     */
    async initializeUI() {
        this.overlay = document.createElement('div');
        this.overlay.id = this.overlayId;
        this.overlay.innerHTML = await loadTemplate('groupManager.html');
        document.body.appendChild(this.overlay);

        const panel = this.overlay.querySelector('.tl-panel');
        const dragHandle = this.overlay.querySelector('#tl-drag');

        makeDraggable(panel, dragHandle);
        makeResizable(panel);
        loadSavedSize(panel);

        this.listEl = this.overlay.querySelector('#tl-groups');

        // Search - uses visibility toggle, not re-render
        const searchInput = this.overlay.querySelector('#tl-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = (e.target.value || '').trim().toLowerCase();
                this.applySearchFilter();
            });
        }

        // Collapse All
        const collapseBtn = this.overlay.querySelector('#tl-collapse-all');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => this.toggleCollapseAll());
        }
    }

    /**
     * Initialize core services
     */
    setupServices() {
        this.state = new GroupManagerState();
        this.autoSave = new AutoSaveManager(this.state);
    }

    /**
     * Set up application-level event handlers
     */
    setupEventHandlers() {
        AppEventHandlers.setupAppEvents(
            this.overlay,
            this.state,
            this.autoSave,
            this, // Pass controller for incremental methods
            slugify,
            () => this.closeIfOpen()
        );
    }

    /**
     * Initial render - only called once on open
     */
    async initialRender() {
        this.listEl.innerHTML = '';
        const gids = Object.keys(this.state.getGroups());

        if (gids.length === 0) {
            this.listEl.innerHTML = `<div class="tl-empty">No groups yet. Click "Add Loot Group".</div>`;
            return;
        }

        for (const gid of gids) {
            await this.appendGroupCard(gid);
        }
    }

    /**
     * Append a single group card to the list
     */
    async appendGroupCard(gid) {
        // Remove empty message if present
        const emptyMsg = this.listEl.querySelector('.tl-empty');
        if (emptyMsg) emptyMsg.remove();

        const group = this.state.getGroup(gid);
        if (!group) return;

        const card = await GroupRenderer.renderSingleGroup(
            group,
            this,
            this.autoSave,
            this.state
        );
        this.listEl.appendChild(card);
        NameResolver.resolveNamesIn(card);
        this.applySearchFilter();
    }

    /**
     * Remove a group card from the DOM
     */
    removeGroupCard(gid) {
        const card = this.listEl.querySelector(`.tl-card[data-gid="${gid}"]`);
        if (card) card.remove();

        // Show empty message if no groups left
        if (this.listEl.children.length === 0) {
            this.listEl.innerHTML = `<div class="tl-empty">No groups yet. Click "Add Loot Group".</div>`;
        }
    }

    /**
     * Get a group card element by ID
     */
    getGroupCard(gid) {
        return this.listEl.querySelector(`.tl-card[data-gid="${gid}"]`);
    }

    /**
     * Apply search filter by toggling visibility
     */
    applySearchFilter() {
        const cards = this.listEl.querySelectorAll('.tl-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const gid = card.dataset.gid;
            const group = this.state.getGroup(gid);
            const name = (group?.name || '').toLowerCase();
            const matches = !this.searchTerm || name.includes(this.searchTerm);

            card.classList.toggle('tl-hidden', !matches);
            if (matches) visibleCount++;
        });

        // Update empty message
        let emptyMsg = this.listEl.querySelector('.tl-empty');
        if (visibleCount === 0 && cards.length > 0) {
            if (!emptyMsg) {
                emptyMsg = document.createElement('div');
                emptyMsg.className = 'tl-empty';
                this.listEl.appendChild(emptyMsg);
            }
            emptyMsg.textContent = `No groups match "${this.searchTerm}".`;
        } else if (emptyMsg && cards.length > 0) {
            emptyMsg.remove();
        }
    }

    /**
     * Toggle collapse state for all groups
     */
    toggleCollapseAll() {
        const cards = Array.from(this.listEl.querySelectorAll('.tl-card:not(.tl-hidden)'));
        if (cards.length === 0) return;

        const anyExpanded = cards.some(c => !c.classList.contains('collapsed'));
        const shouldCollapse = anyExpanded;

        cards.forEach(card => {
            if (shouldCollapse) card.classList.add('collapsed');
            else card.classList.remove('collapsed');

            const gid = card.dataset.gid;
            if (gid) saveCollapsedState(gid, 'group', shouldCollapse);
        });

        const btn = this.overlay.querySelector('#tl-collapse-all');
        if (btn) btn.textContent = shouldCollapse ? "Expand All" : "Collapse All";
    }
}

// Export convenience function for backward compatibility
export async function openGroupManager() {
    const controller = new GroupManagerController();
    await controller.open();
}
