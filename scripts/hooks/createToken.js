'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { enqueueActorTask, withRetries } from '../domain/queue.js';
import { awardActor } from '../domain/awardService.js';
import { findAllGroupsForActor } from '../domain/groupResolver.js';
import { markGrantsStart, markGrantsDone } from '../domain/grantTracker.js';
import { warnDiagnostic } from '../utils/diagnostics.js';

export function setupCreateTokenHook() {
    Hooks.on('createToken', async (tokenDocument, options, userId) => {
        try {
            if (!game.user.isGM) return;
            const actor = tokenDocument?.actor;
            if (!actor) return;
            if (actor.type !== 'npc') return;
            const isLinked = !!(tokenDocument?.actorLink ?? tokenDocument?._source?.actorLink);
            const allowLinkedNpcOverride = !!game.settings.get(MODULE_ID, 'allowLinkedNpcOverride');
            if (isLinked && !allowLinkedNpcOverride) return;

            // If loot was applied earlier in preCreate (for unlinked), only post the chat here
            try {
                const preApplied = tokenDocument.getFlag(MODULE_ID, 'preApplied');
                if (preApplied) {
                    const grantLog = tokenDocument.getFlag(MODULE_ID, 'grantLog') || { currency: {}, items: [] };
                    const awardedGroupNames = tokenDocument.getFlag(MODULE_ID, 'awardedGroupNames') || [];
                    let groupName = awardedGroupNames.join(', ');
                    if (!groupName) {
                        const rules = getEffectiveRulesForActor(actor);
                        const groups = rules ? findAllGroupsForActor(rules, actor) : [];
                        groupName = groups.length ? groups.map(g => g.name).join(', ') : 'Unknown Group';
                    }
                    await postGMChatLog(actor, { name: groupName }, grantLog);
                    try { await tokenDocument.unsetFlag(MODULE_ID, 'preApplied'); } catch { }
                    try { await tokenDocument.unsetFlag(MODULE_ID, 'awardedGroupNames'); } catch { }
                    Hooks.callAll('token-loot.awarded', tokenDocument);
                    return;
                }
            } catch { }

            // Guard: avoid double-award if any other listener or race triggers
            try {
                const awarded = await tokenDocument.getFlag(MODULE_ID, 'awarded');
                if (awarded) return;
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
            warnDiagnostic('Error applying loot on token creation', err);
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
    const receivedMsg = game.i18n.format("TOKEN_LOOT.Chat.LootReceived", {
        actorName: `<strong>${actor.name}</strong>`,
        groupName: `<em>${group.name}</em>`
    });
    lines.push(receivedMsg);
    let hasLoot = false;
    if (Object.keys(grantLog.currency).length) {
        const cur = Object.entries(grantLog.currency)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => `${v} ${k.toUpperCase()}`)
            .join(', ');
        if (cur) {
            const currencyLabel = game.i18n.localize("TOKEN_LOOT.Chat.Currency");
            lines.push(`💰 ${currencyLabel} ${cur}`);
            hasLoot = true;
        }
    }
    if (grantLog.items.length) {
        const itemsLabel = game.i18n.localize("TOKEN_LOOT.Chat.Items");
        lines.push(`📦 ${itemsLabel}`);
        for (const it of grantLog.items) lines.push(`&nbsp;&nbsp;• ${it.qty}x ${it.name}`);
        hasLoot = true;
    }
    if (!hasLoot) {
        const noLootMsg = game.i18n.localize("TOKEN_LOOT.Chat.NoLoot");
        lines.push(`<em>${noLootMsg}</em>`);
    }
    const content = `<div class="token-loot-log">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
    try {
        await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients('GM').map(u => u.id) });
    } catch (e) {
        warnDiagnostic('Failed to create loot summary chat message', e);
    }
}


