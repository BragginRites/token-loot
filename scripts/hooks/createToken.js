'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { enqueueActorTask, withRetries } from '../domain/queue.js';
import { awardActor } from '../domain/awardService.js';
import { findGroupForActor, findAllGroupsForActor } from '../domain/groupResolver.js';
import { markGrantsStart, markGrantsDone } from '../domain/grantTracker.js';

export function setupCreateTokenHook() {
    Hooks.on('createToken', async (tokenDocument, options, userId) => {
        try {
            if (!game.user.isGM) return;
            const actor = tokenDocument?.actor;
            if (!actor) return;

            // Guard: avoid double-award if any other listener or race triggers
            try {
                const awarded = await tokenDocument.getFlag(MODULE_ID, 'awarded');
                if (awarded) return;
            } catch { }

            // If loot was applied earlier in preCreate (for unlinked), only post the chat here
            try {
                const preApplied = tokenDocument.getFlag(MODULE_ID, 'preApplied');
                if (preApplied) {
                    const grantLog = tokenDocument.getFlag(MODULE_ID, 'grantLog') || { currency: {}, items: [] };
                    const rules = getEffectiveRulesForActor(actor);
                    // Just find the single matching group name for display if possible, or generic
                    const group = rules ? findGroupForActor(rules, actor) : { name: 'Unknown Group' };
                    await postGMChatLog(actor, group, grantLog);
                    try { await tokenDocument.unsetFlag(MODULE_ID, 'preApplied'); } catch { }
                    Hooks.callAll('token-loot.awarded', tokenDocument);
                    return;
                }
            } catch { }

            const staggerMs = Number(game.settings.get(MODULE_ID, 'awardStaggerMs') || 0);

            await enqueueActorTask(actor.id, async () => {
                if (staggerMs > 0) await new Promise(r => setTimeout(r, staggerMs));

                const rules = getEffectiveRulesForActor(actor);
                if (!rules) return;
                const groups = findAllGroupsForActor(rules, actor);
                if (!groups?.length) return;

                const grantLog = { currency: {}, items: [] };

                markGrantsStart(tokenDocument.id);
                try { await tokenDocument.setFlag(MODULE_ID, 'awarded', true); } catch { }
                try { await tokenDocument.setFlag(MODULE_ID, 'preApplied', true); } catch { }

                const adapter = game.tokenLoot.adapter;

                for (const group of groups) {
                    await withRetries(() => awardActor(actor, group, grantLog, adapter));
                }

                // Post a single combined chat log
                await postGMChatLog(actor, { name: groups.map(g => g.name).join(', ') }, grantLog);
                try { await tokenDocument.unsetFlag(MODULE_ID, 'preApplied'); } catch { }
                Hooks.callAll('token-loot.awarded', tokenDocument);
                markGrantsDone(tokenDocument.id);
            });
        } catch (err) {
            console.error(`${MODULE_ID} | Error applying loot on token creation`, err);
        }
    });
}

function getEffectiveRulesForActor(actor) {
    // MVP: only world scope
    return game.settings.get(MODULE_ID, 'settings')?.scopes?.world ?? { groups: {} };
}

async function postGMChatLog(actor, group, grantLog) {
    try {
        const enabled = !!game.settings.get(MODULE_ID, 'enableGMChatSummary');
        if (!enabled) return;
    } catch { }
    const lines = [];
    lines.push(`<strong>${actor.name}</strong> received loot from group <em>${group.name}</em>:`);
    let hasLoot = false;
    if (Object.keys(grantLog.currency).length) {
        const cur = Object.entries(grantLog.currency)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => `${v} ${k.toUpperCase()}`)
            .join(', ');
        if (cur) { lines.push(`💰 Currency: ${cur}`); hasLoot = true; }
    }
    if (grantLog.items.length) {
        lines.push(`📦 Items:`);
        for (const it of grantLog.items) lines.push(`&nbsp;&nbsp;• ${it.qty}x ${it.name}`);
        hasLoot = true;
    }
    if (!hasLoot) lines.push(`<em>No items or currency granted.</em>`);
    const content = `<div class="token-loot-log">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
    try {
        await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients('GM').map(u => u.id) });
    } catch (e) {
        console.warn(`${MODULE_ID} | Failed to create chat message`, e);
    }
}

async function grantItems(actor, rows, grantLog) {
    const toCreate = [];
    for (const row of rows ?? []) {
        if (!row?.uuid) continue;
        const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
        try {
            const doc = await fromUuid(row.uuid);
            if (!doc) continue;
            let data = doc.toObject();
            if (data._id) delete data._id;
            data.system = data.system || {};
            data.system.quantity = qty;
            data.flags = data.flags || {};
            data.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };

            // If the granted item is a spell, let the system create the proper scroll (dnd5e)
            try {
                if (String(data.type) === 'spell' && (game.system?.id === 'dnd5e')) {
                    let scrollData = null;
                    const ItemCls = (CONFIG && CONFIG.Item && CONFIG.Item.documentClass) ? CONFIG.Item.documentClass : null;
                    try {
                        if (ItemCls && typeof ItemCls.createScrollFromSpell === 'function') {
                            const created = await ItemCls.createScrollFromSpell(doc);
                            scrollData = created?.toObject ? created.toObject() : created;
                        }
                    } catch { }
                    try {
                        if (!scrollData && game?.dnd5e?.documents?.Item5e?.createScrollFromSpell) {
                            const created = await game.dnd5e.documents.Item5e.createScrollFromSpell(doc);
                            scrollData = created?.toObject ? created.toObject() : created;
                        }
                    } catch { }
                    if (scrollData) {
                        if (scrollData._id) delete scrollData._id;
                        scrollData.system = scrollData.system || {};
                        scrollData.system.quantity = qty;
                        scrollData.flags = Object.assign(scrollData.flags || {}, { [MODULE_ID]: { granted: true, groupId: row.groupId ?? null, sourceSpellUuid: row.uuid } });
                        data = scrollData;
                    }
                }
            } catch { }
            // Auto-equip where appropriate (honor per-row autoEquip flag propagated from block)
            try {
                const t = String(data.type || '').toLowerCase();
                const shouldEquip = !!row.autoEquip;
                if (shouldEquip && game.system?.id === 'dnd5e') {
                    if (t === 'weapon' || t === 'armor' || t === 'equipment') {
                        data.system = data.system || {};
                        if (typeof data.system.equipped === 'boolean') data.system.equipped = true;
                    }
                } else if (shouldEquip && typeof data.system?.equipped === 'boolean') {
                    // Generic fallback for systems that use a boolean equipped field
                    data.system.equipped = true;
                }
            } catch { }
            toCreate.push(data);
            grantLog.items.push({ name: data.name, qty });
        } catch { }
    }
    if (toCreate.length) {
        const perItemDelay = Number(game.settings.get(MODULE_ID, 'awardItemStaggerMs') || 0);
        if (perItemDelay > 0) {
            // Create items sequentially with stagger
            for (const data of toCreate) {
                await actor.createEmbeddedDocuments('Item', [data]);
                await new Promise(r => setTimeout(r, perItemDelay));
            }
        } else {
            await actor.createEmbeddedDocuments('Item', toCreate);
        }
    }
}

function randomIntegerInclusive(min, max) {
    const a = Number.isFinite(min) ? min : 0;
    const b = Number.isFinite(max) ? max : 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}


