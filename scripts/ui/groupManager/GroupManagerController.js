'use strict';

import { loadTemplate } from './services/TemplateLoader.js';
import { makeDraggable, makeResizable, loadSavedSize } from './services/ResizeManager.js';
import { AutoSaveManager } from './services/AutoSaveManager.js';
import { GroupManagerState } from './services/GroupManagerState.js';
import { AppEventHandlers } from './handlers/AppEventHandlers.js';
import { GroupRenderer } from './renderers/GroupRenderer.js';
import { NameResolver } from './services/NameResolver.js';
import { slugify } from '../../utils/settings.js';

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
        
        // Set up panel interactions
        makeDraggable(panel, dragHandle);
        makeResizable(panel);
        loadSavedSize(panel);

        this.listEl = this.overlay.querySelector('#tl-groups');
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
            () => this.renderGroups(), 
            slugify, 
            () => this.closeIfOpen()
        );
    }

    /**
     * Render all groups and their components
     */
    async renderGroups() {
        this.listEl.innerHTML = '';
        const gids = Object.keys(this.state.getGroups());
        
        if (gids.length === 0) {
            this.listEl.innerHTML = `<div class="tl-empty">No groups yet. Click "Add Loot Group".</div>`;
            return;
        }
        
        // Render each group using the GroupRenderer
        for (const gid of gids) {
            const group = this.state.getGroup(gid);
            const card = await GroupRenderer.renderSingleGroup(
                group, 
                () => this.renderGroups(), 
                this.autoSave, 
                this.state
            );
            this.listEl.appendChild(card);
        }

        // Resolve names and images for all rendered elements
        NameResolver.resolveNamesIn(this.listEl);
    }

    /**
     * Perform initial render
     */
    async initialRender() {
        await this.renderGroups();
    }
}

// Export convenience function for backward compatibility
export async function openGroupManager() {
    const controller = new GroupManagerController();
    await controller.open();
}
