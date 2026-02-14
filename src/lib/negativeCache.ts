const KEY = 'subscription:negatives:v1'
const DEFAULT_TTL = 60 * 60 * 1000 // 1 hour

function now(){ return Date.now() }

function loadStore(): Record<string, number> {
  try{
    if(typeof localStorage !== 'undefined'){
      const raw = localStorage.getItem(KEY)
      if(!raw) return {}
      return JSON.parse(raw || '{}')
    }
  }catch(e){}
  // fallback in-memory store (useful for server-side tests)
  // @ts-ignore - attach to globalThis for lifetime during process
  (globalThis as any).__negCacheFallback = (globalThis as any).__negCacheFallback || {}
  return (globalThis as any).__negCacheFallback
}

function saveStore(store: Record<string, number>){
  try{
    if(typeof localStorage !== 'undefined'){
      localStorage.setItem(KEY, JSON.stringify(store))
      return
    }
  }catch(e){}
  (globalThis as any).__negCacheFallback = store
}

export function setNegative(value: string, ttlMs: number = DEFAULT_TTL){
  const store = loadStore()
  store[String(value)] = now() + ttlMs
  saveStore(store)
}

export function isNegative(value: string){
  const store = loadStore()
  const exp = store[String(value)]
  if(!exp) return false
  if(now() > exp){
    // expired — remove and persist
    delete store[String(value)]
    saveStore(store)
    return false
  }
  return true
}

export function clearNegative(value: string){
  const store = loadStore()
  if(store[String(value)]){ delete store[String(value)]; saveStore(store) }
}

export function clearAllNegatives(){ saveStore({}) }

export function getAllNegatives(){ return loadStore() }
