'use strict';

import { selectAll, selectPick, selectChance } from './selection.js';
import { applyCurrency } from './currency.js';
import { MODULE_ID } from '../utils/settings.js';
import { randomIntegerInclusive } from '../utils/random.js';

/**
 * Resolve loot items and currency for a group without granting them.
 * @param {object} group
 * @returns {Promise<{ currency: object, items: object[] }>}
 */
export async function resolveGroupLoot(group) {
    const result = { currency: {}, items: [] };

    if (group.currency) {
        // Just return the raw currency expressions for the caller to evaluate/apply
        // Actually, we can't easily resolve currency values here without an actor context for evaluation?
        // Currency evaluation is async range/roll. We can do it here.
        // But applyCurrency in currency.js takes 'actor' and 'increments' and applies them.
        // Let's return the increments block so caller can use it.
        result.currency = group.currency;
    }

    const items = [];
    for (const block of group.distributionBlocks || []) {
        let chosen = [];
        const validItems = (block.items || []).filter(i => i.uuid);

        if (block.type === 'all') {
            chosen = selectAll(validItems);
        } else if (block.type === 'pick') {
            chosen = selectPick(validItems, Number(block.count || 1), !!block.allowDuplicates);
            // Safety: if duplicates are not allowed, ensure unique UUIDs
            if (!block.allowDuplicates) {
                const seen = new Set();
                chosen = chosen.filter(r => {
                    const id = r?.uuid;
                    if (!id) return false;
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            }
        } else if (block.type === 'chance') {
            const bounded = !!block.useChanceBounds;
            const min = Number(block.chanceMin ?? 1);
            const max = Number(block.chanceMax ?? 1);
            chosen = selectChance(validItems, { bounded, min, max, allowDuplicates: !!block.allowDuplicates });
        }

        // Attach block context
        for (const row of chosen) {
            items.push({
                ...row,
                groupId: block.id,
                autoEquip: !!block.autoEquip
            });
        }
    }
    result.items = items;
    return result;
}

/**
 * Award currency and items to an actor for a group definition.
 * @param {Actor} actor
 * @param {object} group
 * @param {object} grantLog
 * @param {import('../adapters/SystemAdapter').SystemAdapter} adapter
 */
export async function awardActor(actor, group, grantLog, adapter) {
    const { currency, items } = await resolveGroupLoot(group);

    if (currency) {
        await applyCurrency(actor, currency, grantLog, adapter);
    }

    if (items.length > 0) {
        await grantItems(actor, items, grantLog, adapter);
    }
}

/**
 * internal helper to grant items
 * @param {Actor} actor
 * @param {Array<any>} rows
 * @param {object} grantLog
 * @param {import('../adapters/SystemAdapter').SystemAdapter} adapter
 */
async function grantItems(actor, rows, grantLog, adapter) {
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
            // If system has quantity, set it
            if (typeof data.system.quantity === 'number') {
                data.system.quantity = qty;
            }

            // Flags
            data.flags = data.flags || {};
            data.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };

            // Handle Scroll Conversion using Adapter
            if (data.type === 'spell') {
                const scrollData = await adapter.createScroll(doc);
                if (scrollData) {
                    data = scrollData;
                    if (data._id) delete data._id;
                    data.system = data.system || {};
                    if (typeof data.system.quantity === 'number') {
                        data.system.quantity = qty;
                    }
                    data.flags = Object.assign(data.flags || {}, {
                        [MODULE_ID]: { granted: true, groupId: row.groupId ?? null, sourceSpellUuid: row.uuid }
                    });
                }
            }

            // Handle Auto-Equip using Adapter
            if (row.autoEquip) {
                adapter.equipItem(data);
            }

            toCreate.push(data);
            grantLog.items.push({ name: data.name, qty });

        } catch (e) {
            console.warn(`${MODULE_ID} | Failed to resolve/process ${row.uuid}`, e);
        }
    }

    if (toCreate.length > 0) {
        const perItemDelay = Number(game.settings.get(MODULE_ID, 'awardItemStaggerMs') || 0);
        if (perItemDelay > 0) {
            for (const data of toCreate) {
                await actor.createEmbeddedDocuments('Item', [data]);
                await new Promise(r => setTimeout(r, perItemDelay));
            }
        } else {
            await actor.createEmbeddedDocuments('Item', toCreate);
        }
    }
}
