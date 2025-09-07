'use strict';

import { selectAll, selectPick, selectChance, randomIntegerInclusive } from './selection.js';
import { applyCurrency } from './currency.js';

/**
 * @typedef {Object} LootRow
 * @property {string} uuid
 * @property {number} [chance]
 * @property {number} [qtyMin]
 * @property {number} [qtyMax]
 *
 * @typedef {Object} DistributionBlock
 * @property {string} id
 * @property {string} name
 * @property {('all'|'pick'|'chance')} type
 * @property {number} [count]
 * @property {boolean} [useChanceBounds]
 * @property {number} [chanceMin]
 * @property {number} [chanceMax]
 * @property {boolean} [allowDuplicates]
 * @property {LootRow[]} items
 */

/**
 * Award currency and items to an actor for a group definition.
 * @param {{ actor: Actor, group: any, grantLog: any, grantItems: (actor: Actor, rows: LootRow[], log: any) => Promise<void> }} ctx
 */
export async function awardActor({ actor, group, grantLog, grantItems }) {
    if (group.currency) {
        await applyCurrency(actor, group.currency, grantLog);
    }

    for (const block of group.distributionBlocks || []) {
        let chosen = [];
        if (block.type === 'all') {
            chosen = selectAll(block.items || []);
        } else if (block.type === 'pick') {
            chosen = selectPick((block.items || []).filter(i => i.uuid), Number(block.count || 1), !!block.allowDuplicates);
        } else if (block.type === 'chance') {
            const bounded = !!block.useChanceBounds;
            const min = Number(block.chanceMin ?? 1);
            const max = Number(block.chanceMax ?? 1);
            chosen = selectChance(block.items || [], { bounded, min, max, allowDuplicates: !!block.allowDuplicates });
        }
        // Attach block context to each chosen row so grantItems can honor per-block options
        const rowsWithContext = (chosen || []).map(r => ({
            ...r,
            groupId: block.id,
            autoEquip: !!block.autoEquip
        }));
        await grantItems(actor, rowsWithContext, grantLog);
    }
}


