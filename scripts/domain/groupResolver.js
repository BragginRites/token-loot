'use strict';

import { evaluateAllFilters, evaluateFilter, filterGroupKey, getFilterProperties, isFilterComplete } from './filterEngine.js';

/** @param {any} rules @param {Actor} actor */
export function findGroupForActor(rules, actor) {
    return findAllGroupsForActor(rules, actor)[0] || null;
}

/**
 * Find all matching groups for an actor. The actor should be awarded for each group.
 * @param {any} rules
 * @param {Actor} actor
 * @returns {any[]} Array of matching group objects
 */
export function findAllGroupsForActor(rules, actor) {
    return explainAllGroupsForActor(rules, actor)
        .filter(result => result.matched)
        .map(result => result.group);
}

/**
 * Explain matching for all configured groups.
 * @param {any} rules
 * @param {Actor} actor
 * @returns {{ group: any, matched: boolean, reasons: string[] }[]}
 */
export function explainAllGroupsForActor(rules, actor) {
    return _orderedGroups(rules).map(group => explainGroupMatch(group, actor));
}

/**
 * Explain why a group does or does not match an actor.
 * @param {any} group
 * @param {Actor} actor
 * @returns {{ group: any, matched: boolean, reasons: string[] }}
 */
export function explainGroupMatch(group, actor) {
    const mode = group?.mode || 'actors';
    const reasons = [];
    let matched = false;

    if (mode === 'actors') {
        matched = _matchesActorList(group, actor, reasons);
    } else if (mode === 'filtered') {
        matched = _matchesFilters(group, actor, reasons);
    } else {
        reasons.push(`Unknown group mode "${mode}".`);
    }

    return { group, matched, reasons };
}

function _matchesActorList(group, actor, reasons) {
    const candidateUuids = _buildCandidateUuids(actor);
    const canonical = (s) => String(s || '').replace(/\s+\d+$/u, '').trim().toLowerCase();
    const actorKey = canonical(actor.name);

    if (!(group?.actorUUIDs?.length)) {
        reasons.push('No actors assigned.');
        return false;
    }

    for (const uuid of candidateUuids) {
        if (group.actorUUIDs.includes(uuid)) {
            reasons.push(`Actor/source UUID matched: ${uuid}`);
            return true;
        }
    }

    const worldUuids = (group.actorUUIDs ?? []).filter(x => typeof x === 'string' && x.startsWith('Actor.'));
    if (worldUuids.length && typeof game !== 'undefined') {
        for (const a of game.actors) {
            if (!worldUuids.includes(a.uuid)) continue;
            if (canonical(a.name) === actorKey) {
                reasons.push(`Actor name matched assigned world actor: ${a.name}`);
                return true;
            }
        }
    }

    reasons.push('No assigned actor UUID or source ID matched.');
    return false;
}

function _matchesFilters(group, actor, reasons) {
    const filters = group?.filters || [];
    if (!filters.length) {
        reasons.push('No Smart Filters configured.');
        return false;
    }

    const properties = getFilterProperties();
    const matched = evaluateAllFilters(actor, filters, properties);

    for (const filter of filters) {
        if (!isFilterComplete(filter, properties)) {
            const prop = properties.find(p => p.key === filter.property);
            const label = prop?.label || filter.property || 'Unknown';
            reasons.push(`${label}: incomplete (ignored).`);
        }
    }

    const complete = filters.filter(f => isFilterComplete(f, properties));
    if (!complete.length) return false;

    const byProp = new Map();
    for (const f of complete) {
        const key = filterGroupKey(f);
        if (!byProp.has(key)) byProp.set(key, []);
        byProp.get(key).push(f);
    }

    for (const [propKey, groupFilters] of byProp) {
        const baseKey = String(propKey).startsWith('custom::') ? 'custom' : propKey;
        const prop = properties.find(p => p.key === baseKey);
        let label = prop?.label || propKey || 'Unknown';
        if (String(propKey).startsWith('custom::')) {
            const path = String(propKey).slice('custom::'.length);
            label = `${prop?.label || 'Custom'} (${path})`;
        }
        const anyOk = groupFilters.some(f => evaluateFilter(actor, f, properties));
        if (anyOk) {
            const hits = groupFilters.filter(f => evaluateFilter(actor, f, properties));
            const hitText = hits.map(f => `${_operatorText(f.operator)} ${_filterValueText(f)}`).join(' OR ');
            reasons.push(`${label}: matched (${hitText}).`);
        } else {
            const missText = groupFilters.map(f => `${_operatorText(f.operator)} ${_filterValueText(f)}`).join('; ');
            reasons.push(`${label}: did not match (${missText}).`);
        }
    }

    return matched;
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

function _orderedGroups(rules) {
    const groups = rules?.groups || {};
    const order = Array.isArray(rules?.groupOrder) ? rules.groupOrder : [];
    const seen = new Set();
    const ordered = [];

    for (const gid of order) {
        if (!groups[gid] || seen.has(gid)) continue;
        seen.add(gid);
        ordered.push(groups[gid]);
    }

    for (const [gid, group] of Object.entries(groups)) {
        if (seen.has(gid)) continue;
        ordered.push(group);
    }

    return ordered;
}

function _operatorText(op) {
    const labels = {
        'contains': 'contains',
        '=': 'equals',
        '!=': 'does not equal',
        '>': 'is greater than',
        '<': 'is less than',
        '>=': 'is at least',
        '<=': 'is at most',
        'between': 'is between'
    };
    return labels[op] || op;
}

function _filterValueText(filter) {
    if (filter.operator === 'between') return `${filter.value} and ${filter.value2}`;
    return String(filter.value ?? '').trim() || '(empty)';
}
