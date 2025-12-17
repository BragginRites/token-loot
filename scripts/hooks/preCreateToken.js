'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { mergeCurrency } from '../domain/currency.js';
import { findGroupForActor } from '../domain/groupResolver.js';
import { resolveGroupLoot } from '../domain/awardService.js';
import { randomIntegerInclusive } from '../utils/random.js';

export function setupPreCreateTokenHook() {
    Hooks.on('preCreateToken', async (tokenDocument, data, options, userId) => {
        try {
            if (!game.user.isGM) return;
            if (!game.user.isGM) return;
            // Always enabled for unlinked tokens now (V13 standard)
            // const enabled = !!game.settings.get(MODULE_ID, 'usePreCreateForUnlinked');
            // if (!enabled) return;
            const isLinked = !!(data.actorLink ?? tokenDocument?.actorLink);
            if (isLinked) return;

            // Guard: avoid double-award during preCreate
            const flags = (data.flags && data.flags[MODULE_ID]) || tokenDocument?.flags?.[MODULE_ID] || {};
            if (flags.awarded) return;

            const baseActorId = data.actorId || tokenDocument?.actor?.id;
            const baseActor = baseActorId ? game.actors?.get(baseActorId) : null;
            if (!baseActor) return;

            // Avoid getting rules if we don't have a base actor
            const settings = game.settings.get(MODULE_ID, 'settings');
            const rules = settings?.scopes?.world ?? { groups: {} };
            const group = findGroupForActor({ groups: rules.groups }, baseActor); // fix: pass object with groups prop
            if (!group) return;

            const grantLog = { currency: {}, items: [] };

            const { currency, items } = await resolveGroupLoot(group);

            if (currency) {
                data.actorData = data.actorData || {};
                await mergeCurrency(data.actorData, currency);
            }

            const toCreate = [];
            for (const row of items ?? []) {
                if (!row?.uuid) continue;
                // preCreate logic generates items but puts them in actorData.items
                // It CANNOT run asynchronous adapter createScroll easily if it needs to look up items?
                // Actually fromUuid is async loop.
                const qty = randomIntegerInclusive(row.qtyMin ?? 1, row.qtyMax ?? 1);
                try {
                    const doc = await fromUuid(row.uuid);
                    if (!doc) continue;
                    const dataObj = doc.toObject();
                    if (dataObj._id) delete dataObj._id;
                    dataObj.system = dataObj.system || {};
                    if (typeof dataObj.system.quantity === 'number') {
                        dataObj.system.quantity = qty;
                    }

                    // Flags
                    dataObj.flags = dataObj.flags || {};
                    dataObj.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };

                    // Note: We are NOT calling adapter.createScroll or adapter.equipItem here 
                    // because preCreateToken context is weird and might not support full adapter logic 
                    // (which might expect a real Actor or Item document).
                    // However, we COULD try to use adapter.equipItem(dataObj) because it just mutates data!
                    // Let's try it if adapter is available.
                    if (game.tokenLoot.adapter && row.autoEquip) {
                        game.tokenLoot.adapter.equipItem(dataObj);
                    }

                    toCreate.push(dataObj);
                    // Add to log? Log is usually for chat
                    grantLog.items.push({ name: dataObj.name, qty });
                } catch (e) {
                    // ignore errors for individual items
                }
            }

            data.actorData = data.actorData || {};
            if (toCreate.length) {
                const existing = Array.isArray(data.actorData.items) ? data.actorData.items : [];
                data.actorData.items = existing.concat(toCreate);
            }

            data.flags = data.flags || {};
            data.flags[MODULE_ID] = Object.assign({}, data.flags[MODULE_ID], { preApplied: true, awarded: true, grantLog });

        } catch (e) {
            console.warn(`${MODULE_ID} | preCreateToken failed`, e);
        }
    });
}
