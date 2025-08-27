'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { enqueueActorTask, withRetries } from '../domain/queue.js';
import { awardActor } from '../domain/awardService.js';
import { findGroupForActor } from '../domain/groupResolver.js';
import { markGrantsStart, markGrantsDone } from '../domain/grantTracker.js';

export function setupCreateTokenHook() {
    Hooks.on('createToken', async (tokenDocument, options, userId) => {
        try {
            if (!game.user.isGM) return;
            const actor = tokenDocument?.actor;
            if (!actor) return;

            // If loot was applied earlier in preCreate (for unlinked), only post the chat here
            try {
                const preApplied = tokenDocument.getFlag(MODULE_ID, 'preApplied');
                if (preApplied) {
                    const rules = getEffectiveRulesForActor(actor);
                    const group = rules ? findGroupForActor(rules, actor) : null;
                    const grantLog = tokenDocument.getFlag(MODULE_ID, 'grantLog') || { currency: {}, items: [] };
                    if (group) await postGMChatLog(actor, group, grantLog);
                    try { await tokenDocument.unsetFlag(MODULE_ID, 'preApplied'); } catch {}
                    Hooks.callAll('token-loot.awarded', tokenDocument);
                    return;
                }
            } catch {}

            const staggerMs = Number(game.settings.get(MODULE_ID, 'awardStaggerMs') || 0);

            await enqueueActorTask(actor.id, async () => {
                if (staggerMs > 0) await new Promise(r => setTimeout(r, staggerMs));

                const rules = getEffectiveRulesForActor(actor);
                if (!rules) return;
                const group = findGroupForActor(rules, actor);
                if (!group) return;

                const grantLog = { currency: {}, items: [] };

                markGrantsStart(tokenDocument.id);
                try { await tokenDocument.setFlag(MODULE_ID, 'preApplied', true); } catch {}
                await withRetries(() => awardActor({ actor, group, grantLog, grantItems }));
                await postGMChatLog(actor, group, grantLog);
                try { await tokenDocument.unsetFlag(MODULE_ID, 'preApplied'); } catch {}
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

async function grantItems(actor, rows, grantLog) {
    const toCreate = [];
    for (const row of rows ?? []) {
        if (!row?.uuid) continue;
        const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
        try {
            const doc = await fromUuid(row.uuid);
            if (!doc) continue;
            const data = doc.toObject();
            if (data._id) delete data._id;
            data.system = data.system || {};
            data.system.quantity = qty;
            data.flags = data.flags || {};
            data.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };
            toCreate.push(data);
            grantLog.items.push({ name: data.name, qty });
        } catch {}
    }
    if (toCreate.length) await actor.createEmbeddedDocuments('Item', toCreate);
}

async function postGMChatLog(actor, group, grantLog) {
    const lines = [];
    lines.push(`<strong>${actor.name}</strong> received loot from group <em>${group.name}</em>:`);
    let hasLoot = false;
    if (Object.keys(grantLog.currency).length) {
        const cur = Object.entries(grantLog.currency)
            .filter(([k,v]) => v > 0)
            .map(([k,v]) => `${v} ${k.toUpperCase()}`)
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

function randomIntegerInclusive(min, max) {
    const a = Number.isFinite(min) ? min : 0;
    const b = Number.isFinite(max) ? max : 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}


