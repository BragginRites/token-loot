'use strict';

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
 * Merge currency increments into actorData for preCreateToken
 * @param {object} actorData - The actorData object from preCreateToken
 * @param {Record<string,string|number>} increments - Currency expressions
 */
export async function mergeCurrency(actorData, increments) {
    actorData.system = actorData.system || {};
    actorData.system.currency = actorData.system.currency || {};

    for (const [key, expr] of Object.entries(increments)) {
        if (!expr) continue;
        const val = await evaluateCurrencyExpression(expr);
        if (val > 0) {
            actorData.system.currency[key] = (actorData.system.currency[key] ?? 0) + val;
        }
    }
}

/**
 * Apply currency increments to an Actor using the system adapter
 * @param {Actor} actor
 * @param {Record<string,string|number>} increments
 * @param {any} grantLog
 * @param {import('../adapters/SystemAdapter').SystemAdapter} adapter
 */
export async function applyCurrency(actor, increments, grantLog, adapter) {
    const payload = {};
    for (const [key, expr] of Object.entries(increments)) {
        if (!expr) continue;
        const val = await evaluateCurrencyExpression(expr);
        if (val > 0) {
            payload[key] = val;
            grantLog.currency[key] = (grantLog.currency[key] ?? 0) + val;
        }
    }
    if (Object.keys(payload).length > 0) {
        await adapter.addCurrency(actor, payload);
    }
}

