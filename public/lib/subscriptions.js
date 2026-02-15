import { loadJSON, saveJSON } from './storage';
const KEY = 'subscriptions:v1';
export function getSubscriptions() { return loadJSON(KEY, []); }
export function addSubscription(s) {
    const arr = getSubscriptions();
    if (!arr.find(x => x.value === s.value))
        arr.unshift(s);
    saveJSON(KEY, arr);
    return arr;
}
export function removeSubscription(value) {
    const arr = getSubscriptions().filter(x => x.value !== value);
    saveJSON(KEY, arr);
    return arr;
}
export function toggleRecommend(value) {
    const arr = getSubscriptions();
    const idx = arr.findIndex(x => x.value === value);
    if (idx >= 0) {
        arr[idx].recommend = !arr[idx].recommend;
        saveJSON(KEY, arr);
    }
    return arr;
}
