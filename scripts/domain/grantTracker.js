'use strict';

const tokenIdToTracker = new Map();

function ensureTracker(tokenId) {
    let t = tokenIdToTracker.get(tokenId);
    if (!t) {
        let resolve;
        const promise = new Promise(r => { resolve = r; });
        t = { promise, resolve, count: 0 };
        tokenIdToTracker.set(tokenId, t);
    }
    return t;
}

export function markGrantsStart(tokenId) {
    const t = ensureTracker(String(tokenId));
    t.count += 1;
    return t.promise;
}

export function markGrantsDone(tokenId) {
    const key = String(tokenId);
    const t = tokenIdToTracker.get(key);
    if (!t) return;
    t.count = Math.max(0, (t.count || 0) - 1);
    if (t.count === 0) {
        try { t.resolve?.(); } catch {}
        tokenIdToTracker.delete(key);
    }
}

export function waitForGrants(tokenDocumentOrId) {
    const key = typeof tokenDocumentOrId === 'string' ? tokenDocumentOrId : (tokenDocumentOrId?.id ?? '');
    const t = tokenIdToTracker.get(String(key));
    return t ? t.promise : Promise.resolve();
}


