'use strict';

import { AutoSaveManager } from './services/AutoSaveManager.js';
import { GroupManagerState } from './services/GroupManagerState.js';
import { GroupRenderer } from './renderers/GroupRenderer.js';
import { NameResolver } from './services/NameResolver.js';
import { slugify } from '../../utils/StringUtils.js';
import { uniqueGroupId } from '../../utils/GroupUtils.js';
import { saveCollapsedState } from './services/CollapseManager.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main controller for the Group Manager UI — Master/Detail layout.
 * Left sidebar shows group names; right detail panel shows the selected group.
 */
export class GroupManagerController extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'tl-group-manager',
        classes: ['tl-group-manager-app'],
        position: { width: 960, height: 640 },
        window: {
            title: 'Loot Group Manager',
            icon: 'fas fa-list',
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: 'modules/token-loot/templates/groupManager.html'
        }
    };

    constructor(options = {}) {
        super(options);
        this.groupState = new GroupManagerState();
        this.autoSave = new AutoSaveManager(this.groupState);
        this.selectedGroupId = null;
        this.searchTerm = '';
    }

    /* ——— Lifecycle ——— */

    async _onRender(context, options) {
        super._onRender(context, options);

        this.sidebarListEl = this.element.querySelector('#tl-group-list');
        this.detailEl = this.element.querySelector('#tl-detail');

        // Search
        const searchInput = this.element.querySelector('#tl-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = (e.target.value || '').trim().toLowerCase();
                this.applySearchFilter();
            });
        }

        // Add group button
        const addBtn = this.element.querySelector('#tl-add');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const baseTitle = game.i18n.localize('TOKEN_LOOT.Manager.NewGroupDefault') || 'New Loot Group';
                const id = uniqueGroupId(this.groupState.getRules(), slugify(baseTitle) || 'group');
                this.groupState.addGroup(id, { id, name: baseTitle, actorUUIDs: [], currency: {}, distributionBlocks: [] });
                this.autoSave.save();

                // Add sidebar entry and select it
                this._addSidebarItem(id);
                this.selectGroup(id);

                // Focus the title input in the detail pane
                requestAnimationFrame(() => {
                    const input = this.detailEl.querySelector(`.tl-title[data-gid="${id}"]`);
                    if (input) { input.focus(); input.select?.(); }
                });
            });
        }

        await this._buildSidebar();
    }

    /* ——— Sidebar ——— */

    async _buildSidebar() {
        this.sidebarListEl.innerHTML = '';
        const gids = Object.keys(this.groupState.getGroups());

        if (gids.length === 0) {
            this._showSidebarEmpty();
            return;
        }

        for (const gid of gids) {
            this._addSidebarItem(gid);
        }

        // Auto-select the first group
        if (gids.length > 0 && !this.selectedGroupId) {
            this.selectGroup(gids[0]);
        }
    }

    _addSidebarItem(gid) {
        // Remove empty message if present
        const emptyMsg = this.sidebarListEl.querySelector('.tl-sidebar-empty');
        if (emptyMsg) emptyMsg.remove();

        const group = this.groupState.getGroup(gid);
        if (!group) return;

        const item = document.createElement('div');
        item.className = 'tl-sidebar-item';
        item.dataset.gid = gid;

        const actorCount = group.actorUUIDs?.length || 0;
        const blockCount = group.distributionBlocks?.length || 0;
        const icon = group.icon || 'fas fa-users';
        const color = group.color || '#e8ecf1';

        item.style.setProperty('--tl-group-color', color);
        item.innerHTML = `
            <div class="tl-sidebar-item-icon" style="color: ${color}"><i class="${icon}"></i></div>
            <div class="tl-sidebar-item-info">
                <div class="tl-sidebar-item-name">${this._escapeHtml(group.name || 'Untitled')}</div>
                <div class="tl-sidebar-item-meta">${actorCount} actor${actorCount !== 1 ? 's' : ''} · ${blockCount} block${blockCount !== 1 ? 's' : ''}</div>
            </div>
        `;

        item.addEventListener('click', () => this.selectGroup(gid));
        item.addEventListener('contextmenu', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const { openGroupSettingsDialog } = await import('./components/ContextMenu.js');
            const updated = await openGroupSettingsDialog(group);
            if (updated) {
                this.autoSave.save();
                this.refreshSidebar(gid);
                // Also update the title input and detail container color if it's currently selected
                if (this.selectedGroupId === gid) {
                    const titleInput = this.detailEl.querySelector('.tl-title');
                    if (titleInput) titleInput.value = group.name;
                    this.detailEl.style.setProperty('--tl-group-color', group.color || '#e8ecf1');
                }
            }
        });
        this.sidebarListEl.appendChild(item);
    }

    _showSidebarEmpty() {
        this.sidebarListEl.innerHTML = `<div class="tl-sidebar-empty"><i class="fas fa-box-open"></i><span>${game.i18n.localize('TOKEN_LOOT.Manager.NoGroups') || 'No groups yet'}</span></div>`;
    }

    _updateSidebarItem(gid) {
        const item = this.sidebarListEl.querySelector(`.tl-sidebar-item[data-gid="${gid}"]`);
        if (!item) return;

        const group = this.groupState.getGroup(gid);
        if (!group) return;

        const actorCount = group.actorUUIDs?.length || 0;
        const blockCount = group.distributionBlocks?.length || 0;
        const icon = group.icon || 'fas fa-users';
        const color = group.color || '#e8ecf1';
        
        item.style.setProperty('--tl-group-color', color);
        const iconEl = item.querySelector('.tl-sidebar-item-icon');
        if (iconEl) {
            iconEl.style.color = color;
            iconEl.innerHTML = `<i class="${icon}"></i>`;
        }
        item.querySelector('.tl-sidebar-item-name').textContent = group.name || 'Untitled';
        item.querySelector('.tl-sidebar-item-meta').textContent = `${actorCount} actor${actorCount !== 1 ? 's' : ''} · ${blockCount} block${blockCount !== 1 ? 's' : ''}`;
    }

    _removeSidebarItem(gid) {
        const item = this.sidebarListEl.querySelector(`.tl-sidebar-item[data-gid="${gid}"]`);
        if (item) item.remove();

        if (this.sidebarListEl.children.length === 0) {
            this._showSidebarEmpty();
        }
    }

    /* ——— Detail Panel ——— */

    async selectGroup(gid) {
        // Deselect current
        this.sidebarListEl.querySelectorAll('.tl-sidebar-item').forEach(el => el.classList.remove('active'));

        // Select new
        const sidebarItem = this.sidebarListEl.querySelector(`.tl-sidebar-item[data-gid="${gid}"]`);
        if (sidebarItem) sidebarItem.classList.add('active');

        this.selectedGroupId = gid;
        await this._renderDetail(gid);
    }

    async _renderDetail(gid) {
        const group = this.groupState.getGroup(gid);
        if (!group) {
            this.detailEl.innerHTML = `<div class="tl-detail-empty"><i class="fas fa-treasure-chest tl-detail-empty-icon"></i><p>${game.i18n.localize('TOKEN_LOOT.Manager.SelectGroupHint') || 'Select a group to edit'}</p></div>`;
            return;
        }

        this.detailEl.innerHTML = '';
        this.detailEl.style.setProperty('--tl-group-color', group.color || '#e8ecf1');

        const card = await GroupRenderer.renderSingleGroup(
            group,
            this,
            this.autoSave,
            this.groupState
        );

        this.detailEl.appendChild(card);
        NameResolver.resolveNamesIn(card);
    }

    /* ——— Public API (used by GroupRenderer for actions) ——— */

    /** Called after a group card is appended (e.g., duplicate) */
    async appendGroupCard(gid) {
        this._addSidebarItem(gid);
        this.selectGroup(gid);
    }

    /** Called when a group is deleted */
    removeGroupCard(gid) {
        this._removeSidebarItem(gid);

        // If deleted group was selected, select another
        if (this.selectedGroupId === gid) {
            this.selectedGroupId = null;
            const first = this.sidebarListEl.querySelector('.tl-sidebar-item');
            if (first) {
                this.selectGroup(first.dataset.gid);
            } else {
                this.detailEl.innerHTML = `<div class="tl-detail-empty"><i class="fas fa-treasure-chest tl-detail-empty-icon"></i><p>${game.i18n.localize('TOKEN_LOOT.Manager.SelectGroupHint') || 'Select a group to edit'}</p></div>`;
            }
        }
    }

    /** Called to get the card element for a group (used by some renderers) */
    getGroupCard(gid) {
        return this.detailEl.querySelector(`.tl-card[data-gid="${gid}"]`);
    }

    /** Mark the sidebar metadata as dirty so counts update */
    refreshSidebar(gid) {
        if (gid) {
            this._updateSidebarItem(gid);
        }
    }

    /* ——— Search Filter ——— */

    applySearchFilter() {
        const items = this.sidebarListEl.querySelectorAll('.tl-sidebar-item');
        let visibleCount = 0;

        items.forEach(item => {
            const gid = item.dataset.gid;
            const group = this.groupState.getGroup(gid);
            const name = (group?.name || '').toLowerCase();
            const matches = !this.searchTerm || name.includes(this.searchTerm);

            item.classList.toggle('tl-hidden', !matches);
            if (matches) visibleCount++;
        });

        // Show/hide empty message
        let emptyMsg = this.sidebarListEl.querySelector('.tl-sidebar-empty');
        if (visibleCount === 0 && items.length > 0) {
            if (!emptyMsg) {
                emptyMsg = document.createElement('div');
                emptyMsg.className = 'tl-sidebar-empty';
                this.sidebarListEl.appendChild(emptyMsg);
            }
            emptyMsg.innerHTML = `<i class="fas fa-search"></i><span>${game.i18n.format?.('TOKEN_LOOT.Manager.NoSearchResults', { term: this.searchTerm }) || `No matches for "${this.searchTerm}"`}</span>`;
        } else if (emptyMsg && items.length > 0) {
            emptyMsg.remove();
        }
    }

    /* ——— Utilities ——— */

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

let __appInstance = null;

export async function openGroupManager() {
    if (__appInstance) {
        __appInstance.render(true, { focus: true });
    } else {
        __appInstance = new GroupManagerController();
        await __appInstance.render(true);
    }
}
