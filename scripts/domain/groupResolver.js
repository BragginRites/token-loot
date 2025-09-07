'use strict';

/** @param {any} rules @param {Actor} actor */
export function findGroupForActor(rules, actor) {
    const candidateUuids = new Set();
    candidateUuids.add(actor.uuid);
    try { const sid = actor.getFlag?.('core', 'sourceId'); if (sid) candidateUuids.add(sid); } catch {}
    try { const cs = actor._stats?.compendiumSource; if (cs) candidateUuids.add(cs); } catch {}
    try { const ssid = actor._stats?.sourceId; if (ssid) candidateUuids.add(ssid); } catch {}
    try {
        const protoSid = actor.prototypeToken?.flags?.core?.sourceId || actor.prototypeToken?._source?.flags?.core?.sourceId;
        if (protoSid) candidateUuids.add(protoSid);
    } catch {}

    for (const groupId of Object.keys(rules.groups ?? {})) {
        const g = rules.groups[groupId];
        for (const u of candidateUuids) if (g?.actorUUIDs?.includes(u)) return g;
    }

    const canonical = (s) => String(s || '').replace(/\s+\d+$/u, '').trim().toLowerCase();
    const actorKey = canonical(actor.name);
    const worldUuidToGroup = new Map();
    for (const groupId of Object.keys(rules.groups ?? {})) {
        const g = rules.groups[groupId];
        for (const uuid of g?.actorUUIDs ?? []) {
            if (typeof uuid === 'string' && uuid.startsWith('Actor.')) worldUuidToGroup.set(uuid, g);
        }
    }
    if (worldUuidToGroup.size) {
        for (const a of game.actors) {
            if (!worldUuidToGroup.has(a.uuid)) continue;
            if (canonical(a.name) === actorKey) return worldUuidToGroup.get(a.uuid);
        }
    }
    return null;
}

/**
 * Find all matching groups for an actor. The actor should be awarded for each group.
 * @param {any} rules
 * @param {Actor} actor
 * @returns {any[]} Array of matching group objects
 */
export function findAllGroupsForActor(rules, actor) {
    const groups = [];
    const candidateUuids = new Set();
    candidateUuids.add(actor.uuid);
    try { const sid = actor.getFlag?.('core', 'sourceId'); if (sid) candidateUuids.add(sid); } catch {}
    try { const cs = actor._stats?.compendiumSource; if (cs) candidateUuids.add(cs); } catch {}
    try { const ssid = actor._stats?.sourceId; if (ssid) candidateUuids.add(ssid); } catch {}
    try {
        const protoSid = actor.prototypeToken?.flags?.core?.sourceId || actor.prototypeToken?._source?.flags?.core?.sourceId;
        if (protoSid) candidateUuids.add(protoSid);
    } catch {}

    const canonical = (s) => String(s || '').replace(/\s+\d+$/u, '').trim().toLowerCase();
    const actorKey = canonical(actor.name);

    for (const groupId of Object.keys(rules.groups ?? {})) {
        const g = rules.groups[groupId];
        let matched = false;
        for (const u of candidateUuids) { if (g?.actorUUIDs?.includes(u)) { matched = true; break; } }
        if (!matched) {
            // Fallback: name match to world actor UUIDs
            const worldUuids = (g?.actorUUIDs ?? []).filter(x => typeof x === 'string' && x.startsWith('Actor.'));
            if (worldUuids.length) {
                for (const a of game.actors) {
                    if (!worldUuids.includes(a.uuid)) continue;
                    if (canonical(a.name) === actorKey) { matched = true; break; }
                }
            }
        }
        if (matched) groups.push(g);
    }
    return groups;
}


