'use strict';

import { MODULE_ID } from '../utils/settings.js';
import { mergeCurrency } from '../domain/currency.js';
import { findAllGroupsForActor } from '../domain/groupResolver.js';
import { resolveGroupLoot } from '../domain/awardService.js';
import { randomIntegerInclusive } from '../utils/random.js';

export function setupPreCreateTokenHook() {
    Hooks.on('preCreateToken', async (tokenDocument, data, options, userId) => {
        try {
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
            const groups = findAllGroupsForActor({ groups: rules.groups }, baseActor);
            if (!groups?.length) return;

            const grantLog = { currency: {}, items: [] };
            const toCreate = [];
            data.actorData = data.actorData || {};

            for (const group of groups) {
                const { currency, items } = await resolveGroupLoot(group);

                if (currency) {
                    await mergeCurrency(data.actorData, currency, grantLog);
                }

                for (const row of items ?? []) {
                    if (!row?.uuid) continue;
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

                        dataObj.flags = dataObj.flags || {};
                        dataObj.flags[MODULE_ID] = { granted: true, groupId: row.groupId ?? null };

                        // preCreateToken mutates pending actor data; only adapter methods that mutate item data are safe here.
                        if (game.tokenLoot.adapter && row.autoEquip) {
                            game.tokenLoot.adapter.equipItem(dataObj);
                        }

                        toCreate.push(dataObj);
                        grantLog.items.push({ name: dataObj.name, qty });
                    } catch (e) {
                        console.warn(`${MODULE_ID} | Failed to resolve/process ${row.uuid}`, e);
                    }
                }
            }

            if (toCreate.length) {
                const existing = Array.isArray(data.actorData.items) ? data.actorData.items : [];
                data.actorData.items = existing.concat(toCreate);
            }

            data.flags = data.flags || {};
            data.flags[MODULE_ID] = Object.assign({}, data.flags[MODULE_ID], {
                preApplied: true,
                awarded: true,
                grantLog,
                awardedGroupNames: groups.map(g => g.name).filter(Boolean)
            });

        } catch (e) {
            console.warn(`${MODULE_ID} | preCreateToken failed`, e);
        }
    });
}
