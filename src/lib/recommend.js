// Simple, privacy-preserving recommender helpers (no external tracking)
// extract keywords from titles (very simple)
const STOP = new Set(['the','a','an','and','or','to','of','in','on','for','with','is','it','this','that','be','new'])
export function extractKeywords(titles, limit=8){
  const counts = new Map()
  for(const t of titles){
    if(!t) continue
    const parts = t.toLowerCase().replace(/[\W_]+/g,' ').split(/\s+/).filter(Boolean)
    for(const p of parts){ if(p.length<3) continue; if(STOP.has(p)) continue; counts.set(p,(counts.get(p)||0)+1) }
  }
  return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>x[0])
}

export function aggregateSearchResults(resultsByKeyword, existingIds, notInterested){
  // resultsByKeyword: { keyword: [video objects] }
  const score = new Map()
  for(const [kw, arr] of Object.entries(resultsByKeyword)){
    for(const v of arr){
      if(!v || !v.id) continue
      const id = v.id
      if(existingIds.has(id)) continue
      if(notInterested.has(id)) continue
      const s = score.get(id) || {count:0, item: v, keywords: new Set()}
      s.count += 1
      s.keywords.add(kw)
      score.set(id, s)
    }
  }
  // convert to array and sort by count desc then published date
  const out = Array.from(score.values()).map(s=>({ id: s.item.id, title: s.item.title, published: s.item.published, thumbnail: s.item.thumbnail, channelTitle: s.item.channelTitle, keywords: Array.from(s.keywords), score: s.count }))
  out.sort((a,b)=> b.score - a.score || (new Date(b.published) - new Date(a.published)))
  return out
}

// Compose a daily digest: top recommendations plus recent uploads from subscriptions
export function generateDigest(recommendations, videos, subs, notInterested, limit=20){
  // Build boost map from subs
  const boostMap = new Map()
  for(const s of subs){ boostMap.set(s.title || s.value, s.boost || 1) }

  const recs = recommendations.map(r=> ({...r, boosted: (r.score || 1) * (boostMap.get(r.channelTitle) || 1)}))
  // apply recency decay: newer items score higher. decay window ~7 days
  const now = Date.now()
  function recencyFactor(published){
    const days = Math.max(0,(now - new Date(published).getTime()) / (1000*60*60*24))
    // exponential decay with half-life ~7 days
    return Math.exp(-days / 7)
  }
  recs.forEach(r=> r.boosted = r.boosted * recencyFactor(r.published))
  recs.sort((a,b)=> b.boosted - a.boosted || (new Date(b.published) - new Date(a.published)))

  const chosen = []
  const seen = new Set()
  for(const r of recs){ if(chosen.length>=limit) break; if(notInterested.has(r.id)) continue; chosen.push(r); seen.add(r.id) }

  // add recent uploads (videos list gives latest across subs)
  for(const v of videos){ if(chosen.length>=limit) break; if(seen.has(v.id)) continue; if(notInterested.has(v.id)) continue;
    // check per-channel preference
    const sub = subs.find(s=> (s.title && v.channelTitle && s.title===v.channelTitle) || s.value===v.channelTitle )
    if(sub && sub.recommend===false) continue
    chosen.push({id:v.id,title:v.title,published:v.published,thumbnail:v.thumbnail,channelTitle:v.channelTitle, source:'upload'})
    seen.add(v.id)
  }
  return chosen.slice(0,limit)
}
