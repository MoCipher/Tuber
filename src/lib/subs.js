// Pure helpers for subscriptions and seenVideos so we can unit test behavior
export function mergeSubscriptions(existing, imported){
  const map = new Map(existing.map(s=>[s.value, s]))
  for(const s of imported){ if(!map.has(s.value)) map.set(s.value, s) }
  return Array.from(map.values())
}

export function seenSetToArray(set){ return Array.from(set) }
export function arrayToSeenSet(arr){ return new Set(arr || []) }
export function markAllSeenIds(videos, prevSet){ const s = new Set(prevSet); videos.forEach(v=>s.add(v)); return s }
