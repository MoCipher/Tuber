import { loadJSON, saveJSON } from './storage'

export type WatchLaterItem = { id: string; title?: string; thumbnail?: string; addedAt?: number }
const KEY = 'watchLater:v1'

export function getWatchLater(): WatchLaterItem[] { return loadJSON<WatchLaterItem[]>(KEY, []) }
export function isWatchLater(id: string){ return getWatchLater().some(x=>x.id===id) }
export function addWatchLater(item: WatchLaterItem){
  const arr = getWatchLater()
  if(!arr.find(x=>x.id===item.id)) arr.unshift({ ...item, addedAt: Date.now() })
  saveJSON(KEY, arr)
  return arr
}
export function removeWatchLater(id: string){
  const arr = getWatchLater().filter(x=>x.id!==id)
  saveJSON(KEY, arr)
  return arr
}
export function clearWatchLater(){ saveJSON(KEY, []) }
