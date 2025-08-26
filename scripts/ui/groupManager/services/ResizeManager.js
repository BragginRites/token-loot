'use strict';

import { MODULE_ID } from '../../../utils/settings.js';

export function makeDraggable(panel, handle) {
    let startX = 0, startY = 0, originLeft = 0, originTop = 0, dragging = false;
    panel.style.position='fixed'; panel.style.left='50%'; panel.style.top='50%'; panel.style.transform='translate(-50%,-50%)';
    function start(e){ dragging=true; const p=(e.touches&&e.touches[0])||e; startX=p.clientX; startY=p.clientY; const r=panel.getBoundingClientRect(); originLeft=r.left; originTop=r.top;
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
        document.addEventListener('touchmove', move, {passive:false}); document.addEventListener('touchend', end); }
    function move(e){ if(!dragging) return; const p=(e.touches&&e.touches[0])||e; panel.style.left=(originLeft+p.clientX-startX)+'px'; panel.style.top=(originTop+p.clientY-startY)+'px'; panel.style.transform='translate(0,0)'; if (e.cancelable) e.preventDefault(); }
    function end(){ dragging=false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', end); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); }
    handle.addEventListener('mousedown', start); handle.addEventListener('touchstart', start, {passive:true});
}

export function makeResizable(panel) {
    const resizeObserver = new ResizeObserver(() => saveSize(panel));
    resizeObserver.observe(panel);
    panel.addEventListener('mouseup', () => saveSize(panel));
    panel.addEventListener('touchend', () => saveSize(panel));
}

export function saveSize(panel) {
    try {
        const r = panel.getBoundingClientRect();
        const size = { width: Math.round(r.width), height: Math.round(r.height) };
        const existing = game.settings.get(MODULE_ID, 'groupManagerSize') || {};
        if (existing.width === size.width && existing.height === size.height) return;
        game.settings.set(MODULE_ID, 'groupManagerSize', size);
    } catch {}
}

export function loadSavedSize(panel) {
    try {
        const sz = game.settings.get(MODULE_ID, 'groupManagerSize') || {};
        if (sz.width) panel.style.width = sz.width + 'px';
        if (sz.height) panel.style.height = sz.height + 'px';
    } catch {}
}


