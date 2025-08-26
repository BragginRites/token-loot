'use strict';

import { MODULE_ID } from '../utils/settings.js';

/**
 * Evaluate currency expression: integer, range "a-b", or roll formula.
 * @param {string|number} expr
 * @returns {Promise<number>}
 */
export async function evaluateCurrencyExpression(expr) {
    const s = String(expr ?? '').trim();
    if (/^\d+$/.test(s)) return Number(s);
    const range = /^\s*(\d+)\s*-\s*(\d+)\s*$/u.exec(s);
    if (range) {
        const min = Number(range[1]);
        const max = Number(range[2]);
        const lo = Math.min(min, max);
        const hi = Math.max(min, max);
        return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }
    const r = new Roll(s);
    await r.evaluate({ async: true });
    return Math.max(0, Math.floor(r.total ?? 0));
}

/**
 * Apply currency increments to an Actor (createToken path)
 * @param {Actor} actor
 * @param {Record<string,string|number>} increments
 * @param {any} grantLog
 */
export async function applyCurrency(actor, increments, grantLog) {
    const updates = { system: { currency: foundry.utils.deepClone(actor.system.currency ?? {}) } };
    for (const k of ['pp','gp','ep','sp','cp']) {
        const expr = increments?.[k];
        if (!expr) continue;
        const val = await evaluateCurrencyExpression(expr);
        updates.system.currency[k] = (updates.system.currency[k] ?? 0) + val;
        grantLog.currency[k] = (grantLog.currency[k] ?? 0) + val;
    }
    await actor.update(updates);
}

/**
 * Merge currency increments into actorData (preCreate path)
 * @param {any} actorData
 * @param {Record<string,string|number>} increments
 */
export async function mergeCurrency(actorData, increments) {
    const cur = foundry.utils.deepClone(actorData?.system?.currency ?? {});
    for (const k of ['pp','gp','ep','sp','cp']) {
        const expr = increments?.[k];
        if (!expr) continue;
        const val = await evaluateCurrencyExpression(expr);
        cur[k] = (cur[k] ?? 0) + val;
    }
    actorData.system = actorData.system || {};
    actorData.system.currency = cur;
}


