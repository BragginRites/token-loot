'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { mergeCurrency } from '../domain/currency.js';
import { findGroupForActor } from '../domain/groupResolver.js';

export function setupPreCreateTokenHook() {
    Hooks.on('preCreateToken', async (tokenDocument, data, options, userId) => {
        try {
            if (!game.user.isGM) return;
            const enabled = !!game.settings.get(MODULE_ID, 'usePreCreateForUnlinked');
            if (!enabled) return;
            const isLinked = !!(data.actorLink ?? tokenDocument?.actorLink);
            if (isLinked) return;

            const baseActorId = data.actorId || tokenDocument?.actor?.id;
            const baseActor = baseActorId ? game.actors?.get(baseActorId) : null;
            if (!baseActor) return;

            const rules = getEffectiveRulesForActor(baseActor);
            if (!rules) return;
            const group = findGroupForActor(rules, baseActor);
            if (!group) return;

            const grantLog = { currency: {}, items: [] };

            if (group.currency) {
                data.actorData = data.actorData || {};
                await mergeCurrency(data.actorData, group.currency);
            }

            const chosenRows = [];
            for (const block of group.distributionBlocks || []) {
                if (!block.items || block.items.length === 0) continue;
                if (block.type === 'all') {
                    chosenRows.push(...(block.items || []));
                } else if (block.type === 'pick') {
                    const count = block.count || 1;
                    const availableItems = block.items.filter(item => item.uuid);
                    if (block.allowDuplicates) {
                        for (let i = 0; i < count && availableItems.length > 0; i++) {
                            chosenRows.push(availableItems[Math.floor(Math.random() * availableItems.length)]);
                        }
                    } else {
                        chosenRows.push(...randomSample(availableItems, Math.min(count, availableItems.length)));
                    }
                } else if (block.type === 'chance') {
                    const minCount = Math.max(0, Number(block.chanceMin ?? 1));
                    const maxCount = Math.max(minCount, Number(block.chanceMax ?? minCount));
                    const target = randomIntegerInclusive(minCount, maxCount);
                    const pool = [...(block.items || [])];
                    const successes = [];
                    const allowDup = !!block.allowDuplicates;
                    let safety = 1000;
                    while (successes.length < target && safety-- > 0) {
                        const order = [...pool];
                        for (let i = order.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [order[i], order[j]] = [order[j], order[i]];
                        }
                        for (const row of order) {
                            const p = typeof row.chance === 'number' ? row.chance : 0;
                            if (Math.random() * 100 < p) {
                                successes.push(row);
                                if (!allowDup) {
                                    const idx = pool.indexOf(row);
                                    if (idx >= 0) pool.splice(idx, 1);
                                }
                                if (successes.length >= target) break;
                            }
                        }
                        if (!allowDup && pool.length === 0) break;
                    }
                    chosenRows.push(...successes);
                }
            }

            const toCreate = [];
            for (const row of chosenRows ?? []) {
                if (!row?.uuid) continue;
                const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
                try {
                    const doc = await fromUuid(row.uuid);
                    if (!doc) continue;
                    const dataObj = doc.toObject();
                    if (dataObj._id) delete dataObj._id;
                    dataObj.system = dataObj.system || {};
                    dataObj.system.quantity = qty;
                    dataObj.flags = dataObj.flags || {};
                    dataObj.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };
                    toCreate.push(dataObj);
                } catch {}
            }

            data.actorData = data.actorData || {};
            if (toCreate.length) {
                const existing = Array.isArray(data.actorData.items) ? data.actorData.items : [];
                data.actorData.items = existing.concat(toCreate);
            }

            data.flags = data.flags || {};
            data.flags[MODULE_ID] = data.flags[MODULE_ID] || {};
            data.flags[MODULE_ID].preApplied = true;
        } catch (e) {
            console.warn(`${MODULE_ID} | preCreateToken failed`, e);
        }
    });
}

function getEffectiveRulesForActor(actor) {
    return game.settings.get(MODULE_ID, 'settings')?.scopes?.world ?? { groups: {} };
}

function randomIntegerInclusive(min, max) {
    const a = Number.isFinite(min) ? min : 0;
    const b = Number.isFinite(max) ? max : 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function randomSample(arr, k) {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < k && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
    }
    return out;
}


