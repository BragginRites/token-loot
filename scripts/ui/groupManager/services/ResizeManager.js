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
    // Create the resize handle element
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'tl-resize-handle';
    panel.appendChild(resizeHandle);

    let isResizing = false;
    let startX = 0, startY = 0;
    let startWidth = 0, startHeight = 0;

    function startResize(e) {
        isResizing = true;
        const touch = e.touches && e.touches[0];
        const clientX = touch ? touch.clientX : e.clientX;
        const clientY = touch ? touch.clientY : e.clientY;
        
        startX = clientX;
        startY = clientY;
        
        const rect = panel.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        
        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        panel.style.pointerEvents = 'auto';
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchmove', resize, { passive: false });
        document.addEventListener('touchend', stopResize);
        
        if (e.preventDefault) e.preventDefault();
    }

    function resize(e) {
        if (!isResizing) return;
        
        const touch = e.touches && e.touches[0];
        const clientX = touch ? touch.clientX : e.clientX;
        const clientY = touch ? touch.clientY : e.clientY;
        
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        
        const newWidth = Math.max(400, Math.min(startWidth + deltaX, window.innerWidth * 0.95));
        const newHeight = Math.max(300, Math.min(startHeight + deltaY, window.innerHeight * 0.95));
        
        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
        
        if (e.preventDefault) e.preventDefault();
    }

    function stopResize() {
        if (!isResizing) return;
        
        isResizing = false;
        
        // Restore normal interaction
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchmove', resize);
        document.removeEventListener('touchend', stopResize);
        
        // Save the new size
        saveSize(panel);
    }

    // Bind resize events to the handle
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize, { passive: false });

    // Keep the resize observer for other resize events
    const resizeObserver = new ResizeObserver(() => saveSize(panel));
    resizeObserver.observe(panel);
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


