'use strict';

/**
 * Check if a folder document is the target folder or a descendant of it
 * @param {Folder} folderDoc - The folder document to check
 * @param {string} targetId - The target folder ID
 * @returns {boolean} True if the folder matches or is a descendant
 */
function isFolderOrAncestor(folderDoc, targetId) {
    let cur = folderDoc;
    while (cur) {
        if (cur.id === targetId) return true;
        cur = cur.folder;
    }
    return false;
}

/**
 * Collect all actor UUIDs from a folder (including subfolders)
 * @param {Folder} folder - The folder to collect actors from
 * @returns {Promise<string[]>} Array of actor UUIDs
 */
export async function collectActorsFromFolder(folder) {
    const out = [];
    const targetId = folder?.id;
    if (!targetId) return out;

    if (folder.pack) {
        const pack = game.packs.get(folder.pack);
        if (pack && pack.documentName === 'Actor') {
            const docs = await pack.getDocuments();
            for (const d of docs) if (isFolderOrAncestor(d.folder, targetId)) out.push(d.uuid);
        }
    } else if (folder.contents) {
        for (const a of folder.contents) out.push(a.uuid);
    } else {
        for (const a of game.actors) if (isFolderOrAncestor(a.folder, targetId)) out.push(a.uuid);
    }
    return out;
}

/**
 * Collect all item UUIDs from a folder (including subfolders)
 * @param {Folder} folder - The folder to collect items from
 * @returns {Promise<string[]>} Array of item UUIDs
 */
export async function collectItemsFromFolder(folder) {
    const out = [];
    const targetId = folder?.id;
    if (!targetId) return out;

    if (folder.pack) {
        const pack = game.packs.get(folder.pack);
        if (pack && pack.documentName === 'Item') {
            const docs = await pack.getDocuments();
            for (const d of docs) if (isFolderOrAncestor(d.folder, targetId)) out.push(d.uuid);
        }
    } else if (folder.contents) {
        for (const item of folder.contents) out.push(item.uuid);
    } else {
        for (const item of game.items) if (isFolderOrAncestor(item.folder, targetId)) out.push(item.uuid);
    }
    return out;
}
