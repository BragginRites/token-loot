'use strict';

/**
 * Return a shallow copy of items.
 * @template T
 * @param {T[]} items
 */
export function selectAll(items) {
    return [...(items || [])];
}

/**
 * Pick N items from the array.
 * @template T
 * @param {T[]} items
 * @param {number} count
 * @param {boolean} allowDuplicates
 */
export function selectPick(items, count = 1, allowDuplicates = false) {
    const available = (items || []).filter(Boolean);
    if (allowDuplicates) {
        const out = [];
        for (let i = 0; i < count && available.length > 0; i++) {
            out.push(available[Math.floor(Math.random() * available.length)]);
        }
        return out;
    }
    return randomSample(available, Math.min(count, available.length));
}

/**
 * Chance selection.
 * By default, rolls the chance for each item independently once and returns all successes.
 * When bounded mode is enabled, first rolls a target between min and max, then runs independent
 * chances across the pool (respecting allowDuplicates) until the target is met.
 *
 * @template T extends { chance?: number }
 * @param {T[]} items
 * @param {{ bounded?: boolean, min?: number, max?: number, allowDuplicates?: boolean }} opts
 */
export function selectChance(items, { bounded = false, min = 1, max = 1, allowDuplicates = false } = {}) {
    const pool = [...(items || [])];

    // Unbounded: roll once per item, include all successes
    if (!bounded) {
        const successes = [];
        for (const row of pool) {
            const p = typeof row.chance === 'number' ? row.chance : 0;
            if (Math.random() * 100 < p) successes.push(row);
        }
        return successes;
    }

    // Bounded: meet a random target within [min, max]
    const minCount = Math.max(0, Number(min));
    const maxCount = Math.max(minCount, Number(max));
    const target = randomIntegerInclusive(minCount, maxCount);
    const successes = [];
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
                if (!allowDuplicates) {
                    const idx = pool.indexOf(row);
                    if (idx >= 0) pool.splice(idx, 1);
                }
                if (successes.length >= target) break;
            }
        }
        if (!allowDuplicates && pool.length === 0) break;
    }
    return successes;
}

/** @param {number} min @param {number} max */
export function randomIntegerInclusive(min, max) {
    const a = Number.isFinite(min) ? min : 0;
    const b = Number.isFinite(max) ? max : 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** @template T @param {T[]} arr @param {number} k */
export function randomSample(arr, k) {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < k && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
    }
    return out;
}


