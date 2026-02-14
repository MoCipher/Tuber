import { loadJSON, saveJSON } from './storage'

export type Subscription = { value: string; title?: string; recommend?: boolean }
const KEY = 'subscriptions:v1'

export function getSubscriptions(): Subscription[] { return loadJSON<Subscription[]>(KEY, []) }
export function addSubscription(s: Subscription){
  const arr = getSubscriptions()
  if(!arr.find(x=>x.value === s.value)) arr.unshift(s)
  saveJSON(KEY, arr)
  return arr
}
export function removeSubscription(value: string){
  const arr = getSubscriptions().filter(x=>x.value !== value)
  saveJSON(KEY, arr)
  return arr
}
export function toggleRecommend(value: string){
  const arr = getSubscriptions()
  const idx = arr.findIndex(x=>x.value===value)
  if(idx>=0){ arr[idx].recommend = !arr[idx].recommend; saveJSON(KEY, arr) }
  return arr
}
