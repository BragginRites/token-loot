'use strict';

import { evaluateAllFilters } from './filterEngine.js';

/** @param {any} rules @param {Actor} actor */
export function findGroupForActor(rules, actor) {
    const candidateUuids = _buildCandidateUuids(actor);
    const canonical = (s) => String(s || '').replace(/\s+\d+$/u, '').trim().toLowerCase();
    const actorKey = canonical(actor.name);

    for (const groupId of Object.keys(rules.groups ?? {})) {
        const g = rules.groups[groupId];
        const mode = g?.mode || 'actors';

        if (mode === 'actors') {
            // 1. Explicit UUID match
            for (const u of candidateUuids) if (g?.actorUUIDs?.includes(u)) return g;

            // 2. Name-based fallback (world actor UUIDs)
            const worldUuids = (g?.actorUUIDs ?? []).filter(x => typeof x === 'string' && x.startsWith('Actor.'));
            if (worldUuids.length) {
                for (const a of game.actors) {
                    if (!worldUuids.includes(a.uuid)) continue;
                    if (canonical(a.name) === actorKey) return g;
                }
            }
        } else if (mode === 'filtered') {
            // Filtered groups: evaluate filters only
            if (g?.filters?.length > 0 && evaluateAllFilters(actor, g.filters)) return g;
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
    const candidateUuids = _buildCandidateUuids(actor);
    const canonical = (s) => String(s || '').replace(/\s+\d+$/u, '').trim().toLowerCase();
    const actorKey = canonical(actor.name);

    for (const groupId of Object.keys(rules.groups ?? {})) {
        const g = rules.groups[groupId];
        const mode = g?.mode || 'actors';
        let matched = false;

        if (mode === 'actors') {
            // 1. Explicit UUID match
            for (const u of candidateUuids) { if (g?.actorUUIDs?.includes(u)) { matched = true; break; } }

            // 2. Fallback: name match to world actor UUIDs
            if (!matched) {
                const worldUuids = (g?.actorUUIDs ?? []).filter(x => typeof x === 'string' && x.startsWith('Actor.'));
                if (worldUuids.length) {
                    for (const a of game.actors) {
                        if (!worldUuids.includes(a.uuid)) continue;
                        if (canonical(a.name) === actorKey) { matched = true; break; }
                    }
                }
            }
        } else if (mode === 'filtered') {
            // Filtered groups: evaluate filters only
            if (g?.filters?.length > 0) {
                matched = evaluateAllFilters(actor, g.filters);
            }
        }

        if (matched) groups.push(g);
    }
    return groups;
}

/** Build the set of candidate UUIDs for matching */
function _buildCandidateUuids(actor) {
    const uuids = new Set();
    uuids.add(actor.uuid);
    try { const sid = actor.getFlag?.('core', 'sourceId'); if (sid) uuids.add(sid); } catch {}
    try { const cs = actor._stats?.compendiumSource; if (cs) uuids.add(cs); } catch {}
    try { const ssid = actor._stats?.sourceId; if (ssid) uuids.add(ssid); } catch {}
    try {
        const protoSid = actor.prototypeToken?.flags?.core?.sourceId || actor.prototypeToken?._source?.flags?.core?.sourceId;
        if (protoSid) uuids.add(protoSid);
    } catch {}
    return uuids;
}
