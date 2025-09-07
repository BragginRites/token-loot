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


