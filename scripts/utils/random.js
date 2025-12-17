'use strict';

/**
 * Generates a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomIntegerInclusive(min, max) {
    const a = Number.isFinite(min) ? min : 0;
    const b = Number.isFinite(max) ? max : 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Select items based on independent percentage chances.
 * @param {Array<{chance: number, [key: string]: any}>} rows
 * @returns {Array<any>}
 */
export function rollIndependentChances(rows) {
    const successes = [];
    for (const row of rows ?? []) {
        const p = typeof row.chance === 'number' ? row.chance : 0;
        if (Math.random() * 100 < p) successes.push(row);
    }
    return successes;
}

/**
 * Returns a random sample of k elements from an array.
 * @template T
 * @param {T[]} arr
 * @param {number} k
 * @returns {T[]}
 */
export function randomSample(arr, k) {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < k && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
    }
    return out;
}
