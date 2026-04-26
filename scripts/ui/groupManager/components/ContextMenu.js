'use strict';

import { loadTemplate } from '../services/TemplateLoader.js';

export async function confirmDialog(title, message, { skipConfirm = false } = {}) {
	if (skipConfirm) return true;
	const html = await loadTemplate('confirmDialog.html', { title, message });
	const overlay = document.createElement('div');
	overlay.innerHTML = html.trim();
	const root = overlay.firstElementChild;
	return new Promise(resolve => {
		function cleanup(result){ try { root.remove(); } catch {} resolve(result); }
		root.querySelector('.tl-confirm-ok')?.addEventListener('click', () => cleanup(true));
		root.querySelector('.tl-confirm-cancel')?.addEventListener('click', () => cleanup(false));
		root.addEventListener('click', ev => { if (ev.target === root) cleanup(false); });
		document.body.appendChild(root);
		root.querySelector('.tl-confirm-cancel')?.focus();
	});
}

export function openBlockContextMenu(x, y, { onCopy, onPaste }) {
	const menu = document.createElement('div');
	menu.className = 'tl-context-menu';
	menu.style.position = 'fixed';
	menu.style.left = x + 'px';
	menu.style.top = y + 'px';
	menu.style.zIndex = 20;
	menu.innerHTML = `
		<div class="tl-context-item" data-action="copy">Copy Block</div>
		<div class="tl-context-item" data-action="paste">Paste Block</div>
	`;
	document.body.appendChild(menu);
	const cleanup = () => { try { menu.remove(); } catch {} document.removeEventListener('click', onDoc); document.removeEventListener('contextmenu', onDoc); };
	function onDoc(ev){ if (ev.target.closest('.tl-context-menu')) return; cleanup(); }

	document.addEventListener('click', onDoc, { once: true });
	document.addEventListener('contextmenu', onDoc, { once: true });
	menu.addEventListener('click', ev => {
		const action = ev.target.closest('.tl-context-item')?.dataset.action;
		if (action === 'copy') { onCopy?.(); cleanup(); }
		else if (action === 'paste') { onPaste?.(); cleanup(); }
	});
}

export function openGroupSettingsDialog(group) {
	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'tl-confirm-overlay';

		const curatedIcons = [
			'fas fa-users', 'fas fa-skull', 'fas fa-dragon', 'fas fa-ghost',
			'fas fa-gem', 'fas fa-coins', 'fas fa-box-open', 'fas fa-khanda',
			'fas fa-shield-alt', 'fas fa-flask', 'fas fa-scroll', 'fas fa-paw',
			'fas fa-crown', 'fas fa-spider', 'fas fa-campground', 'fas fa-dungeon'
		];
		
		const iconGridHtml = curatedIcons.map(icon => 
			`<div class="tl-icon-grid-item ${group.icon === icon ? 'active' : ''}" data-icon="${icon}" title="${icon}">
				<i class="${icon}"></i>
			</div>`
		).join('');

		overlay.innerHTML = `
			<div class="tl-confirm-dialog" style="min-width: 320px;">
				<div class="tl-confirm-header">Group Settings</div>
				<div class="tl-confirm-body" style="display: flex; flex-direction: column; gap: 16px;">
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<label style="font-size: 12px; color: #9ca3af; font-weight: 600;">Name</label>
						<input type="text" id="tl-group-name-input" value="${group.name || ''}" style="padding: 8px 10px; border-radius: 4px; border: 1px solid #3a4a5a; background: #0a0e14; color: #e8ecf1; font-family: inherit;">
					</div>
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<label style="font-size: 12px; color: #9ca3af; font-weight: 600;">Icon</label>
						<div class="tl-icon-grid">${iconGridHtml}</div>
						<input type="text" id="tl-group-icon-input" value="${group.icon || 'fas fa-users'}" placeholder="e.g. fas fa-skull" style="padding: 8px 10px; border-radius: 4px; border: 1px solid #3a4a5a; background: #0a0e14; color: #e8ecf1; font-family: inherit;">
					</div>
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<label style="font-size: 12px; color: #9ca3af; font-weight: 600;">Color</label>
						<input type="color" id="tl-group-color-input" value="${group.color || '#e8ecf1'}" style="width: 100%; height: 36px; padding: 0; border: none; border-radius: 4px; background: transparent; cursor: pointer;">
					</div>
				</div>
				<div class="tl-confirm-actions">
					<button class="tl-confirm-btn tl-confirm-cancel">Cancel</button>
					<button class="tl-confirm-btn tl-confirm-ok tl-primary" style="background: #4a8c2a; border-color: #5a9c3a;">Save</button>
				</div>
			</div>
		`;

		function cleanup(updated) {
			try { overlay.remove(); } catch {}
			resolve(updated);
		}

		// Handle icon grid clicks
		const iconInput = overlay.querySelector('#tl-group-icon-input');
		const iconItems = overlay.querySelectorAll('.tl-icon-grid-item');
		
		iconItems.forEach(item => {
			item.addEventListener('click', () => {
				iconItems.forEach(i => i.classList.remove('active'));
				item.classList.add('active');
				iconInput.value = item.dataset.icon;
			});
		});

		overlay.querySelector('.tl-confirm-ok').addEventListener('click', () => {
			group.name = overlay.querySelector('#tl-group-name-input').value;
			group.icon = overlay.querySelector('#tl-group-icon-input').value;
			group.color = overlay.querySelector('#tl-group-color-input').value;
			cleanup(true);
		});

		overlay.querySelector('.tl-confirm-cancel').addEventListener('click', () => cleanup(false));
		overlay.addEventListener('click', ev => { if (ev.target === overlay) cleanup(false); });

		document.body.appendChild(overlay);
		overlay.querySelector('#tl-group-name-input').focus();
	});
}
