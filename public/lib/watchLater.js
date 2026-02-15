import { loadJSON, saveJSON } from './storage';
const KEY = 'watchLater:v1';
export function getWatchLater() { return loadJSON(KEY, []); }
export function isWatchLater(id) { return getWatchLater().some(x => x.id === id); }
export function addWatchLater(item) {
    const arr = getWatchLater();
    if (!arr.find(x => x.id === item.id))
        arr.unshift({ ...item, addedAt: Date.now() });
    saveJSON(KEY, arr);
    try {
        window.dispatchEvent(new CustomEvent('watchlater:changed', { detail: arr }));
    }
    catch (e) { }
    return arr;
}
export function removeWatchLater(id) {
    const arr = getWatchLater().filter(x => x.id !== id);
    saveJSON(KEY, arr);
    try {
        window.dispatchEvent(new CustomEvent('watchlater:changed', { detail: arr }));
    }
    catch (e) { }
    return arr;
}
export function clearWatchLater() { saveJSON(KEY, []); try {
    window.dispatchEvent(new CustomEvent('watchlater:changed', { detail: [] }));
}
catch (e) { } }
