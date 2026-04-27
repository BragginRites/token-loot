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

        this._setupLinkedNpcOverrideFooter();

        // Add group button
        const addBtn = this.element.querySelector('#tl-add');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                // Show mode choice dialog
                const mode = await this._showModeChoiceDialog();
                if (!mode) return; // cancelled

                const baseTitle = game.i18n.localize('TOKEN_LOOT.Manager.NewGroupDefault') || 'New Loot Group';
                const id = uniqueGroupId(this.groupState.getRules(), slugify(baseTitle) || 'group');
                const groupData = {
                    id,
                    name: baseTitle,
                    mode,
                    actorUUIDs: [],
                    filters: [],
                    currency: {},
                    distributionBlocks: []
                };
                this.groupState.addGroup(id, groupData);
                this.autoSave.save();

                // Add sidebar entry and select it
                this._addSidebarItem(id);
                this.selectGroup(id);
            });
        }

        await this._buildSidebar();
    }

    /* ——— Sidebar ——— */

    async _buildSidebar() {
        this.sidebarListEl.innerHTML = '';
        const gids = this.groupState.getOrderedGroupIds();

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

        const icon = group.icon || 'fas fa-users';
        const color = group.color || '#e8ecf1';
        const metaParts = this._buildMetaParts(group);

        item.style.setProperty('--tl-group-color', color);
        item.draggable = true;
        item.innerHTML = `
            <div class="tl-sidebar-item-icon" style="color: ${color}"><i class="${icon}"></i></div>
            <div class="tl-sidebar-item-info">
                <div class="tl-sidebar-item-name">${this._escapeHtml(group.name || 'Untitled')}</div>
                <div class="tl-sidebar-item-meta">${metaParts.join(' · ')}</div>
            </div>
            <div class="tl-sidebar-item-actions">
                <button class="tl-sidebar-action tl-sidebar-duplicate" type="button" title="${game.i18n.localize('TOKEN_LOOT.Card.DuplicateGroup') || 'Duplicate Group'}">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="tl-sidebar-action tl-sidebar-delete" type="button" title="${game.i18n.localize('TOKEN_LOOT.Card.DeleteGroup') || 'Delete Group'}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        item.addEventListener('click', () => this.selectGroup(gid));
        this._setupSidebarDragEvents(item, gid);
        item.querySelector('.tl-sidebar-duplicate')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await this._duplicateGroup(gid);
        });
        item.querySelector('.tl-sidebar-delete')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await this._deleteGroup(gid, { skipConfirm: !!ev.shiftKey });
        });
        item.addEventListener('contextmenu', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await this._openGroupSettings(gid);
        });
        item.addEventListener('dblclick', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await this._openGroupSettings(gid);
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

        const icon = group.icon || 'fas fa-users';
        const color = group.color || '#e8ecf1';
        const metaParts = this._buildMetaParts(group);
        
        item.style.setProperty('--tl-group-color', color);
        const iconEl = item.querySelector('.tl-sidebar-item-icon');
        if (iconEl) {
            iconEl.style.color = color;
            iconEl.innerHTML = `<i class="${icon}"></i>`;
        }
        item.querySelector('.tl-sidebar-item-name').textContent = group.name || 'Untitled';
        item.querySelector('.tl-sidebar-item-meta').textContent = metaParts.join(' · ');
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
        await this._buildSidebar();
        this.applySearchFilter();
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

    _buildMetaParts(group) {
        const mode = group.mode || 'actors';
        const blockCount = group.distributionBlocks?.length || 0;
        const parts = [];

        if (mode === 'actors') {
            const actorCount = group.actorUUIDs?.length || 0;
            parts.push(`${actorCount} actor${actorCount !== 1 ? 's' : ''}`);
        } else {
            const filterCount = group.filters?.length || 0;
            parts.push(`${filterCount} filter${filterCount !== 1 ? 's' : ''}`);
        }
        parts.push(`${blockCount} block${blockCount !== 1 ? 's' : ''}`);
        return parts;
    }

    _setupLinkedNpcOverrideFooter() {
        const input = this.element.querySelector('#tl-linked-npc-override');
        if (!input) return;

        const renderState = () => {
            const enabled = !!game.settings.get('token-loot', 'allowLinkedNpcOverride');
            input.checked = enabled;
        };

        renderState();
        input.addEventListener('change', async () => {
            await game.settings.set('token-loot', 'allowLinkedNpcOverride', !!input.checked);
            renderState();
        });
    }

    _setupSidebarDragEvents(item, gid) {
        item.addEventListener('dragstart', ev => {
            if (ev.target.closest('.tl-sidebar-action')) {
                ev.preventDefault();
                return;
            }

            this.draggedGroupId = gid;
            item.classList.add('tl-dragging');
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', gid);
        });

        item.addEventListener('dragover', ev => {
            const draggedId = this.draggedGroupId || ev.dataTransfer.getData('text/plain');
            if (!draggedId || draggedId === gid) return;

            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'move';
            this._clearSidebarDropTargets();
            item.classList.add(this._getDropPosition(ev, item) === 'after' ? 'tl-drop-after' : 'tl-drop-before');
        });

        item.addEventListener('dragleave', ev => {
            if (item.contains(ev.relatedTarget)) return;
            item.classList.remove('tl-drop-before', 'tl-drop-after');
        });

        item.addEventListener('drop', async ev => {
            ev.preventDefault();
            const draggedId = this.draggedGroupId || ev.dataTransfer.getData('text/plain');
            const position = this._getDropPosition(ev, item);
            this._clearSidebarDropTargets();
            if (!draggedId || draggedId === gid) return;

            const moved = this.groupState.moveGroup(draggedId, gid, position);
            if (!moved) return;

            this.draggedGroupId = null;
            this.autoSave.save();
            await this._buildSidebar();
            this.applySearchFilter();
            if (this.selectedGroupId) {
                const selected = this.sidebarListEl.querySelector(`.tl-sidebar-item[data-gid="${this.selectedGroupId}"]`);
                selected?.classList.add('active');
            }
        });

        item.addEventListener('dragend', () => {
            this.draggedGroupId = null;
            this.sidebarListEl.querySelectorAll('.tl-sidebar-item').forEach(el => {
                el.classList.remove('tl-dragging', 'tl-drop-before', 'tl-drop-after');
            });
        });
    }

    _getDropPosition(ev, item) {
        const rect = item.getBoundingClientRect();
        return ev.clientY > rect.top + (rect.height / 2) ? 'after' : 'before';
    }

    _clearSidebarDropTargets() {
        this.sidebarListEl.querySelectorAll('.tl-sidebar-item').forEach(el => {
            el.classList.remove('tl-drop-before', 'tl-drop-after');
        });
    }

    _showModeChoiceDialog() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'tl-confirm-overlay tl-mode-overlay';

            overlay.innerHTML = `
                <div class="tl-confirm-dialog tl-mode-dialog">
                    <div class="tl-confirm-header">${game.i18n.localize('TOKEN_LOOT.Manager.ChooseMode') || 'Choose Group Type'}</div>
                    <div class="tl-mode-dialog-body">
                        <button class="tl-mode-choice" data-mode="actors">
                            <i class="fas fa-user"></i>
                            <span class="tl-mode-choice-title">${game.i18n.localize('TOKEN_LOOT.Card.ModeActors') || 'Individual Actors'}</span>
                            <span class="tl-mode-choice-desc">${game.i18n.localize('TOKEN_LOOT.Manager.ModeActorsDesc') || 'Drag & drop specific actors into this group.'}</span>
                        </button>
                        <button class="tl-mode-choice" data-mode="filtered">
                            <i class="fas fa-wand-magic-sparkles"></i>
                            <span class="tl-mode-choice-title">${game.i18n.localize('TOKEN_LOOT.Card.ModeFiltered') || 'Smart Filters'}</span>
                            <span class="tl-mode-choice-desc">${game.i18n.localize('TOKEN_LOOT.Manager.ModeFilteredDesc') || 'Match actors dynamically using rules (type, CR, etc).'}</span>
                        </button>
                    </div>
                    <div class="tl-confirm-actions">
                        <button class="tl-confirm-btn tl-confirm-cancel">${game.i18n.localize('Cancel') || 'Cancel'}</button>
                    </div>
                </div>
            `;

            function cleanup(result) {
                try { overlay.remove(); } catch {}
                resolve(result);
            }

            overlay.querySelectorAll('.tl-mode-choice').forEach(btn => {
                btn.addEventListener('click', () => cleanup(btn.dataset.mode));
            });
            overlay.querySelector('.tl-confirm-cancel')?.addEventListener('click', () => cleanup(null));

            document.body.appendChild(overlay);
        });
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async _duplicateGroup(gid) {
        const originalGroup = this.groupState.getGroup(gid);
        if (!originalGroup) return;
        const baseTitle = game.i18n.format("TOKEN_LOOT.Card.DuplicateGroupTitle", { name: originalGroup.name });
        const id = uniqueGroupId(this.groupState.getRules(), slugify(baseTitle) || 'group');

        const duplicatedGroup = {
            ...structuredClone(originalGroup),
            id,
            name: baseTitle
        };

        if (duplicatedGroup.distributionBlocks) {
            duplicatedGroup.distributionBlocks = duplicatedGroup.distributionBlocks.map(block => ({
                ...block,
                id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }));
        }

        this.groupState.addGroup(id, duplicatedGroup);
        this.groupState.moveGroup(id, gid, 'after');
        await this.appendGroupCard(id);
        this.autoSave.save();
    }

    async _deleteGroup(gid, { skipConfirm = false } = {}) {
        const group = this.groupState.getGroup(gid);
        if (!group) return;

        const { confirmDialog } = await import('./components/ContextMenu.js');
        const title = game.i18n.localize('TOKEN_LOOT.Dialog.DeleteGroupTitle') || 'Delete Loot Group?';
        const prompt = game.i18n.format("TOKEN_LOOT.Dialog.DeleteGroupPrompt", { name: group.name || group.id });
        const ok = await confirmDialog(title, prompt, { skipConfirm });
        if (!ok) return;

        this.groupState.removeGroup(gid);
        this.removeGroupCard(gid);
        this.autoSave.save();
    }

    async _openGroupSettings(gid) {
        const group = this.groupState.getGroup(gid);
        if (!group) return;
        const { openGroupSettingsDialog } = await import('./components/ContextMenu.js');
        const updated = await openGroupSettingsDialog(group);
        if (!updated) return;

        this.autoSave.save();
        this.refreshSidebar(gid);
        if (this.selectedGroupId === gid) {
            const titleEl = this.detailEl.querySelector('.tl-title');
            if (titleEl) titleEl.textContent = group.name;
            this.detailEl.style.setProperty('--tl-group-color', group.color || '#e8ecf1');
        }
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
