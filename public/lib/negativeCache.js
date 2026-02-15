const KEY = 'subscription:negatives:v1';
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
function now() { return Date.now(); }
function loadStore() {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(KEY);
            if (!raw)
                return {};
            return JSON.parse(raw || '{}');
        }
    }
    catch (e) { }
    // fallback in-memory store (useful for server-side tests)
    // @ts-ignore - attach to globalThis for lifetime during process
    globalThis.__negCacheFallback = globalThis.__negCacheFallback || {};
    return globalThis.__negCacheFallback;
}
function saveStore(store) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(KEY, JSON.stringify(store));
            return;
        }
    }
    catch (e) { }
    globalThis.__negCacheFallback = store;
}
export function setNegative(value, ttlMs = DEFAULT_TTL) {
    const store = loadStore();
    store[String(value)] = now() + ttlMs;
    saveStore(store);
}
export function isNegative(value) {
    const store = loadStore();
    const exp = store[String(value)];
    if (!exp)
        return false;
    if (now() > exp) {
        // expired — remove and persist
        delete store[String(value)];
        saveStore(store);
        return false;
    }
    return true;
}
export function clearNegative(value) {
    const store = loadStore();
    if (store[String(value)]) {
        delete store[String(value)];
        saveStore(store);
    }
}
export function clearAllNegatives() { saveStore({}); }
export function getAllNegatives() { return loadStore(); }
