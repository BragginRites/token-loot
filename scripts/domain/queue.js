'use strict';

import { MODULE_ID } from '../utils/settings.js';

const actorIdToPromise = new Map();

/**
 * Enqueue a task per-actor to avoid race conditions on embedded updates.
 * @param {string} actorId
 * @param {() => Promise<any>} taskFn
 */
export function enqueueActorTask(actorId, taskFn) {
    const previous = actorIdToPromise.get(actorId) || Promise.resolve();
    const next = previous
        .then(() => taskFn())
        .catch(e => { console.error(`${MODULE_ID} | Actor queue task failed`, e); })
        .finally(() => {
            if (actorIdToPromise.get(actorId) === next) actorIdToPromise.delete(actorId);
        });
    actorIdToPromise.set(actorId, next);
    return next;
}

/**
 * Retry a promise-returning function with linear backoff.
 * @param {() => Promise<T>} fn
 * @param {number} [attempts=3]
 * @param {number} [baseDelayMs=50]
 * @template T
 */
export async function withRetries(fn, attempts = 3, baseDelayMs = 50) {
    let n = 0;
    for (;;) {
        try { return await fn(); }
        catch (e) {
            n++;
            if (n >= attempts) throw e;
            await new Promise(r => setTimeout(r, baseDelayMs * n));
        }
    }
}


