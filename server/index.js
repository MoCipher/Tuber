const express = require('express')
const axios = require('axios')
const { XMLParser } = require('fast-xml-parser')
const cheerio = require('cheerio')
const cors = require('cors')
const { extractKeywords } = require('../src/lib/recommend')

const app = express()
app.use(cors())
app.use(express.json())

// In-memory discovery debug buffer (dev-only, capped)
const DISCOVERY_DEBUG_LIMIT = 50
const discoveryDebug = []
let discoveryCaptureEnabled = true // runtime toggle

// Simple in-memory cache with TTL
const cache = new Map() // key -> { ts, ttl, val }
function setCache(key, val, ttlMs){ cache.set(key, { ts: Date.now(), ttl: ttlMs, val }) }
function getCache(key){ const e = cache.get(key); if(!e) return null; if(Date.now() - e.ts > e.ttl) { cache.delete(key); return null } return e.val }

// Backoff map for per-query exponential backoff to avoid aggressive scraping
const BACKOFF_BASE_MS = 5000
const BACKOFF_MAX_MS = 5 * 60 * 1000
const backoffMap = new Map() // key -> { failures, lastErrorAt }

function getBackoffRemainingMs(key){
  const s = backoffMap.get(key)
  if(!s || !s.lastErrorAt) return 0
  // only start applying backoff after 2+ consecutive failures to avoid blocking single flukes
  if((s.failures || 0) < 2) return 0
  const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(0, (s.failures || 0) - 1)), BACKOFF_MAX_MS)
  const elapsed = Date.now() - s.lastErrorAt
  return delay > elapsed ? (delay - elapsed) : 0
}
function recordFailure(key){ const s = backoffMap.get(key) || { failures: 0, lastErrorAt: 0 }; s.failures = (s.failures || 0) + 1; s.lastErrorAt = Date.now(); backoffMap.set(key, s) }
function recordSuccess(key){ backoffMap.delete(key) }

// helper to push debug entries (keeps cap)
function pushDiscoveryDebug(entry){ try{ discoveryDebug.push(entry); if(discoveryDebug.length > DISCOVERY_DEBUG_LIMIT) discoveryDebug.shift() }catch(e){} }

// Helper: try fetching a feed url and return response json
async function tryFeed(url){
  try{
    const resp = await axios.get(url, { responseType: 'text' })
    const parser = new XMLParser({ ignoreAttributes: false })
    return { ok: true, json: parser.parse(resp.data) }
  }catch(err){
    return { ok: false, err }
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/feed', async (req, res) => {
  const channelId = req.query.channel_id
  const user = req.query.user
  if(!channelId && !user) return res.status(400).json({error:'channel_id or user is required'})

  try{
    if(channelId){
      const asChannel = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`)
      if(asChannel.ok) return res.json(asChannel.json)
      const asUser = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(channelId)}`)
      if(asUser.ok) return res.json(asUser.json)
      const asHandle = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+channelId)}`)
      if(asHandle.ok) return res.json(asHandle.json)
      return res.status(404).json({error: `No feed found for '${channelId}'`})
    }

    if(user){
      const result = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(user)}`)
      if(result.ok) return res.json(result.json)
      const asHandle = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+user)}`)
      if(asHandle.ok) return res.json(asHandle.json)
      return res.status(404).json({error: `No feed found for user '${user}'`})
    }
  }catch(err){
    console.error(err)
    res.status(500).json({error: 'Unexpected error'})
  }
})

app.get('/api/channel/avatar', async (req, res) => {
  const channelId = req.query.channel_id
  const handle = req.query.handle
  if(!channelId && !handle) return res.status(400).json({ error: 'channel_id or handle required' })
  try{
    const url = channelId ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}` : `https://www.youtube.com/${encodeURIComponent(handle)}`
    const r = await axios.get(url, { responseType: 'text' })
    const $ = cheerio.load(r.data)
    const og = $('meta[property="og:image"]').attr('content') || null
    return res.json({ thumbnail: og || null })
  }catch(e){ return res.json({ thumbnail: null }) }
})

app.get('/api/search', async (req, res) => {
  const q = req.query.q || req.query.query
  if(!q) return res.status(400).json({error: 'query is required'})

  if(req.query.quick === '1' || req.query.quick === 'true'){
    try{
      const searchUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`
      const resp = await axios.get(searchUrl, { responseType: 'text' })
      const parser = new XMLParser({ ignoreAttributes: false })
      const json = parser.parse(resp.data)
      return res.json(json)
    }catch(e){ return res.json({ feed: { title: 'No results', entry: [] } }) }
  }

  const cacheKey = `search:${q}`
  const cached = getCache(cacheKey)
  if(cached) return res.json(cached)

  async function tryUrl(u){
    try{
      const resp = await axios.get(u, { responseType: 'text' })
      const parser = new XMLParser({ ignoreAttributes: false })
      return { ok: true, json: parser.parse(resp.data) }
    }catch(err){ return { ok: false, err } }
  }

  try{
    const searchPromise = (async ()=>{
      const searchUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`
      const resp = await tryUrl(searchUrl)
      return resp.ok ? {type:'search', data: resp.json} : null
    })()

    const feedFallbackPromise = (async ()=>{
      const asUser = await tryUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(q)}`)
      if(asUser.ok) return {type:'feed', data: asUser.json}
      const asHandle = await tryUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+q)}`)
      if(asHandle.ok) return {type:'feed', data: asHandle.json}
      const asChannel = await tryUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(q)}`)
      if(asChannel.ok) return {type:'feed', data: asChannel.json}
      return null
    })()

    const discoverPromise = (async ()=>{
      try{
        const backoffKey = `discover:${q}`
        if(getBackoffRemainingMs(backoffKey) > 0) return null
        const controller = new AbortController();
        const id = setTimeout(()=>controller.abort(), 3000)
        const dres = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, signal: controller.signal })
        clearTimeout(id)
        const $ = cheerio.load(dres.data)
        const channelLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
        if(channelLink){
          const parts = channelLink.split('/').filter(Boolean)
          const idFrag = parts[parts.length-1]
          const feedResp = await tryUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
          if(feedResp.ok){ recordSuccess(backoffKey); return {type:'feed', data: feedResp.json} }
        }
        return null
      }catch(e){ recordFailure(`discover:${q}`); return null }
    })()

    const results = await Promise.allSettled([searchPromise, feedFallbackPromise, discoverPromise])
    let chosen = null
    let bestConf = -1
    for(const r of results.map(x=>x.status==='fulfilled'?x.value:null)){
      if(!r) continue
      if(r.type === 'feed'){
        const feed = r.data.feed || r.data
        const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : [])
        const conf = (r.data && typeof r.data.confidence === 'number') ? r.data.confidence : 0.5
        if(entries && entries.length>0 && conf > bestConf){ chosen = r.data; bestConf = conf }
      }
    }
    if(!chosen){
      const s = results.find(x=>x.status==='fulfilled' && x.value && x.value.type==='search')
      if(s && s.value) chosen = s.value.data
    }

    const out = chosen || { feed: { title: 'No results', entry: [] } }
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(err){
    console.error('search error', err && err.message)
    return res.status(500).json({error: 'Search feed failed'})
  }
})

app.get('/api/discover', async (req, res) => {
  const q = req.query.q || req.query.query
  const aggressive = String(req.query.aggressive || '').toLowerCase() === '1' || String(req.query.aggressive || '').toLowerCase() === 'true'
  if(!q) return res.status(400).json({ error: 'query is required' })

  const backoffKey = `discover:${q}`
  const remaining = getBackoffRemainingMs(backoffKey)
  if(remaining > 0 && !aggressive){
    // honor explicit backoff even if a cached discovery exists
    return res.status(429).json({ error: 'backoff', retryAfterMs: Math.ceil(remaining) })
  }

  const cacheKey = `discover:${q}`
  const cached = getCache(cacheKey)
  if(cached && !aggressive) return res.json(cached)

  try{
    if(aggressive){
      try{
        const mUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`
        const mres = await axios.get(mUrl, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 3000 })
        if(mres && mres.data){
          const $m = cheerio.load(mres.data)
          const mChannel = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
          if(mChannel){
            const parts = mChannel.split('/').filter(Boolean)
            const idFrag = parts[parts.length-1]
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
            if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.8, source: 'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }
          const mWatch = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && h.startsWith('/watch'))
          if(mWatch){
            const mm = mWatch.match(/v=([\w-]+)/)
            if(mm){
              const vid = mm[1]
              try{
                const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
                const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.75, source: 'mobile' }
                recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out)
              }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
            }
          }
        }
      }catch(e){ /* continue to desktop attempt below if mobile-first fails */ }
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    const resp = await axios.get(url, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' } })
    const $ = cheerio.load(resp.data)

    // Try to extract structured data from ytInitialData JSON embedded in the page
    try{
      const scriptHtml = $('script').toArray().map(s=>$(s).html()).filter(Boolean).join('\n')
      // attempt to find ytInitialData JSON
      const m = scriptHtml.match(/ytInitialData\s*=\s*(\{.*\})\s*;?\s*$/ms) || scriptHtml.match(/window\["ytInitialData"\]\s*=\s*(\{.*\})\s*;?\s*$/ms)
      if(m && m[1]){
        try{
          const json = JSON.parse(m[1])
          // helper to recursively search for renderers
          function findRenderer(obj, key){
            if(!obj || typeof obj !== 'object') return null
            if(obj[key]) return obj[key]
            for(const k of Object.keys(obj)){
              try{
                const res = findRenderer(obj[k], key)
                if(res) return res
              }catch(e){}
            }
            return null
          }
          const ch = findRenderer(json, 'channelRenderer')
          if(ch && ch.channelId){
            const idFrag = ch.channelId
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
            if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.95, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }
          const v = findRenderer(json, 'videoRenderer')
          if(v && v.videoId){
            const vid = v.videoId
            try{
              const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
              const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.95, source: 'ytInitialData' }
              recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out)
            }catch(e){ const out = { type:'video', id: vid, confidence: 0.9, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }
        }catch(e){ /* JSON parse error — fall back to anchor parsing below */ }
      }
    }catch(e){ /* ignore structured parse errors */ }

    // fallback: try to find channel links first (also look for @handles and /c/ custom URLs)
    const channelLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
    if(channelLink){
      const parts = channelLink.split('/').filter(Boolean)
      const idFrag = parts[parts.length-1]
      // try channel_id, then user, then @handle
      let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
      if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
      if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
      if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.6, source: 'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
    }
    // try user links
    const userLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && h.startsWith('/user/'))
    if(userLink){
      const id = userLink.split('/').pop()
      const feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(id)}`)
      if(feedResp.ok){ const out = { type: 'feed', id, feed: feedResp.json, confidence: 0.6, source: 'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
    }
    // try to find a video link
    const watchLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && h.startsWith('/watch'))
    if(watchLink){
      const m = watchLink.match(/v=([\w-]+)/)
      if(m){
        const vid = m[1]
        // get oembed to extract title/thumbnail without scraping more
        try{
          const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
          const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.7, source: 'anchor' }
          recordSuccess(backoffKey);
          setCache(cacheKey, out, 5 * 60 * 1000)
          return res.json(out)
        }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
      }
    }

    // nothing useful found — try mobile site as a fallback (sometimes markup differs)
    try{
      const mUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`
      let mres = null
      try{
        mres = await axios.get(mUrl, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 3000 })
      }catch(e){ mres = null }

      if(mres && mres.data){
        try{
          const $m = cheerio.load(mres.data)
          // mobile page: prefer channel links or watch links
          const mChannel = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
          if(mChannel){
            const parts = mChannel.split('/').filter(Boolean)
            const idFrag = parts[parts.length-1]
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
            if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.8, source: 'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }

          const mWatch = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && h.startsWith('/watch'))
          if(mWatch){
            const mm = mWatch.match(/v=([\w-]+)/)
            if(mm){
              const vid = mm[1]
              try{
                const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
                const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.75, source: 'mobile' }
                recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out)
              }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
            }
          }
        }catch(e){ /* ignore parsing errors for mobile page */ }
      }

      const sampleHrefs = $('a').toArray().map(a=>$(a).attr('href')).filter(Boolean).slice(0,20)
      if(discoveryCaptureEnabled){
        console.debug(`[discover] no match for q=${q}; anchors sample:`, sampleHrefs.slice(0,10))
        // push a small debug record for developer inspection (only in memory)
        pushDiscoveryDebug({ ts: Date.now(), q, sampleHrefs: sampleHrefs.slice(0,10) })
      }else{
        console.debug(`[discover] capture disabled; skipping debug for q=${q}`)
      }
    }catch(e){ /* ignore logging errors */ }
    const out = { type: 'none', confidence: 0 }
    recordSuccess(backoffKey)
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(err){
    console.error('discover error', err && err.message)
    recordFailure(`discover:${q}`)
    return res.status(500).json({ error: 'Discovery failed' })
  }
})

app.get('/api/debug/discover', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  return res.json({ logs: discoveryDebug, enabled: discoveryCaptureEnabled })
})
app.post('/api/debug/discover/clear', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  discoveryDebug.length = 0
  return res.json({ ok: true })
})

app.post('/api/debug/discover/event', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  try{
    const body = req.body || {}
    const entry = { ts: Date.now(), q: body.q, note: body.note || body.reason || null, meta: body }
    pushDiscoveryDebug(entry)
    return res.json({ ok: true, entry })
  }catch(e){ return res.status(500).json({ error: 'failed' }) }
})

app.post('/api/debug/discover/set', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  const { enabled } = req.body || {}
  if(typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled boolean required' })
  discoveryCaptureEnabled = enabled
  if(enabled){ for(const k of Array.from(cache.keys())){ if(k.startsWith('discover:')) cache.delete(k) } }
  return res.json({ ok: true, enabled: discoveryCaptureEnabled })
})

app.get('/api/debug/backoff', (req, res) => {
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  const out = {}
  for(const [k, v] of backoffMap.entries()){
    const remaining = getBackoffRemainingMs(k)
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(0, (v.failures || 0) - 1)), BACKOFF_MAX_MS)
    out[k] = { failures: v.failures || 0, lastErrorAt: v.lastErrorAt || 0, remainingMs: remaining, nextDelayMs: delay }
  }
  return res.json({ backoff: out })
})

app.post('/api/debug/backoff/clear', (req, res) => {
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  const { key } = req.body || {}
  if(key){
    backoffMap.delete(key)
    return res.json({ ok: true, cleared: key })
  }
  backoffMap.clear()
  return res.json({ ok: true, cleared: 'all' })
})

// Test-only: allow setting a backoff entry deterministically when TEST_FIXTURES is enabled
app.post('/api/debug/backoff/set', (req, res) => {
  console.debug('[debug/backoff/set] incoming body=', req.body)
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  if(!process.env.TEST_FIXTURES) return res.status(404).json({ error: 'not available' })
  const { key, failures = 1, lastErrorAt } = req.body || {}
  if(!key) return res.status(400).json({ error: 'key required' })
  backoffMap.set(String(key), { failures: Number(failures), lastErrorAt: Number(lastErrorAt) || Date.now() })
  console.debug('[debug/backoff/set] set', key, 'failures=', failures)
  return res.json({ ok: true, key, failures: Number(failures) })
})
console.debug('[routes] /api/debug/backoff/set registered (dev-only)')

app.get('/api/similar', async (req, res) => {
  const subsParam = req.query.subs // comma separated channel titles or values
  const keywordsParam = req.query.keywords
  const ttlMs = 5 * 60 * 1000

  let key
  if(subsParam) key = `similar:subs:${subsParam}`
  else if(keywordsParam) key = `similar:kw:${keywordsParam}`
  const cached = key ? getCache(key) : null
  if(cached) return res.json(cached)

  try{
    const urls = []
    if(keywordsParam){ const kws = String(keywordsParam).split(/[,\s]+/).filter(Boolean); for(const k of kws.slice(0,3)){ urls.push(`https://www.youtube.com/results?search_query=${encodeURIComponent(k)}`) } }
    const channels = []
    for(const u of urls){ try{ const r = await axios.get(u, { responseType: 'text' }); const $ = cheerio.load(r.data); const found = $('a').toArray().map(a=>$(a).attr('href')).filter(Boolean).filter(h=>h.startsWith('/channel/')).slice(0,5); for(const f of found){ const id = f.split('/').filter(Boolean).pop(); channels.push({ channelId: id, channelTitle: id }) } }catch(e){} }
    const out = { channels }
    if(key) setCache(key, out, ttlMs)
    return res.json(out)
  }catch(e){ return res.status(500).json({ error: 'similar failed' }) }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use((_req, res)=> res.status(404).json({ error: 'not found' }))

module.exports = app

if(require.main === module){
  const port = process.env.PORT || 4000
  app.listen(port, ()=> console.log('Server listening on', port))
}



// Search endpoint: uses YouTube's search RSS feed to support basic discovery without APIs
app.get('/api/search', async (req, res) => {
  const q = req.query.q || req.query.query
  if(!q) return res.status(400).json({error: 'query is required'})

  // quick mode: only run the primary search RSS and return immediately
  if(req.query.quick === '1' || req.query.quick === 'true'){
    try{
      const searchUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`
      const resp = await axios.get(searchUrl, { responseType: 'text' })
      const parser = new XMLParser({ ignoreAttributes: false })
      const json = parser.parse(resp.data)
      return res.json(json)
    }catch(e){ return res.json({ feed: { title: 'No results', entry: [] } }) }
  }

  // caching
  const cacheKey = `search:${q}`
  const cached = getCache(cacheKey)
  if(cached) return res.json(cached)

  async function tryUrl(u){
    try{
      const resp = await axios.get(u, { responseType: 'text' })
      const parser = new XMLParser({ ignoreAttributes: false })
      return { ok: true, json: parser.parse(resp.data) }
    }catch(err){ return { ok: false, err } }
  }

  try{
    // Run three strategies in parallel: search RSS, feed fallbacks, and discovery scrape
    const searchPromise = (async ()=>{
      const searchUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`
      const resp = await tryUrl(searchUrl)
      return resp.ok ? {type:'search', data: resp.json} : null
    })()

    const feedFallbackPromise = (async ()=>{
      const asUser = await tryUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(q)}`)
      if(asUser.ok) return {type:'feed', data: asUser.json}
      const asHandle = await tryUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+q)}`)
      if(asHandle.ok) return {type:'feed', data: asHandle.json}
      const asChannel = await tryUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(q)}`)
      if(asChannel.ok) return {type:'feed', data: asChannel.json}
      return null
    })()

    const discoverPromise = (async ()=>{
      // tiny timeout for discovery scrape so we don't block too long
      try{
        const backoffKey = `discover:${q}`
        if(getBackoffRemainingMs(backoffKey) > 0) return null
        const controller = new AbortController();
        const id = setTimeout(()=>controller.abort(), 3000)
        const dres = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, signal: controller.signal })
        clearTimeout(id)
        const $ = cheerio.load(dres.data)
        const channelLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
        if(channelLink){
          const parts = channelLink.split('/').filter(Boolean)
          const idFrag = parts[parts.length-1]
          const feedResp = await tryUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
          if(feedResp.ok){ recordSuccess(backoffKey); return {type:'feed', data: feedResp.json} }
        }
        return null
      }catch(e){ recordFailure(`discover:${q}`); return null }
    })()

    const results = await Promise.allSettled([searchPromise, feedFallbackPromise, discoverPromise])
    // prefer feed with entries — choose feed with highest confidence if available, otherwise search results
    let chosen = null
    let bestConf = -1
    for(const r of results.map(x=>x.status==='fulfilled'?x.value:null)){
      if(!r) continue
      if(r.type === 'feed'){
        const feed = r.data.feed || r.data
        const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : [])
        const conf = (r.data && typeof r.data.confidence === 'number') ? r.data.confidence : 0.5
        if(entries && entries.length>0 && conf > bestConf){ chosen = r.data; bestConf = conf }
      }
    }
    if(!chosen){
      const s = results.find(x=>x.status==='fulfilled' && x.value && x.value.type==='search')
      if(s && s.value) chosen = s.value.data
    }

    const out = chosen || { feed: { title: 'No results', entry: [] } }
    // cache for 5 min
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(err){
    console.error('search error', err && err.message)
    return res.status(500).json({error: 'Search feed failed'})
  }
})

// discovery endpoint: attempt to find a channel or a video from YouTube search HTML
app.get('/api/discover', async (req, res) => {
  const q = req.query.q || req.query.query
  const aggressive = String(req.query.aggressive || '').toLowerCase() === '1' || String(req.query.aggressive || '').toLowerCase() === 'true'
  if(!q) return res.status(400).json({ error: 'query is required' })

  const cacheKey = `discover:${q}`
  const cached = getCache(cacheKey)
  if(cached && !aggressive) return res.json(cached)

  try{
    const backoffKey = `discover:${q}`
    const remaining = getBackoffRemainingMs(backoffKey)
    if(remaining > 0 && !aggressive){
      return res.status(429).json({ error: 'backoff', retryAfterMs: Math.ceil(remaining) })
    }

    // If aggressive is requested, prefer mobile-first discovery because mobile markup is often simpler
    if(aggressive){
      try{
        const mUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`
        const mres = await axios.get(mUrl, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 3000 })
        if(mres && mres.data){
          const $m = cheerio.load(mres.data)
          const mChannel = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
          if(mChannel){
            const parts = mChannel.split('/').filter(Boolean)
            const idFrag = parts[parts.length-1]
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
            if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.8, source: 'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }
          const mWatch = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && h.startsWith('/watch'))
          if(mWatch){
            const mm = mWatch.match(/v=([\w-]+)/)
            if(mm){ const vid = mm[1]; try{ const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`); const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.75, source: 'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) } }
          }
        }
      }catch(e){ /* continue to desktop attempt below if mobile-first fails */ }
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    const resp = await axios.get(url, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' } })
    const $ = cheerio.load(resp.data)

    // Try to extract structured data from ytInitialData JSON embedded in the page
    try{
      const scriptHtml = $('script').toArray().map(s=>$(s).html()).filter(Boolean).join('\n')
      // attempt to find ytInitialData JSON
      const m = scriptHtml.match(/ytInitialData\s*=\s*(\{.*\})\s*;?\s*$/ms) || scriptHtml.match(/window\["ytInitialData"\]\s*=\s*(\{.*\})\s*;?\s*$/ms)
      if(m && m[1]){
        try{
          const json = JSON.parse(m[1])
          // helper to recursively search for renderers
          function findRenderer(obj, key){
            if(!obj || typeof obj !== 'object') return null
            if(obj[key]) return obj[key]
            for(const k of Object.keys(obj)){
              try{
                const res = findRenderer(obj[k], key)
                if(res) return res
              }catch(e){}
            }
            return null
          }
          const ch = findRenderer(json, 'channelRenderer')
          if(ch && ch.channelId){
            const idFrag = ch.channelId
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
            if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.95, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }
          const v = findRenderer(json, 'videoRenderer')
          if(v && v.videoId){
            const vid = v.videoId
            try{
              const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
              const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.95, source: 'ytInitialData' }
              recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out)
            }catch(e){ const out = { type:'video', id: vid, confidence: 0.9, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }
        }catch(e){ /* JSON parse error — fall back to anchor parsing below */ }
      }
    }catch(e){ /* ignore structured parse errors */ }

    // fallback: try to find channel links first (also look for @handles and /c/ custom URLs)
    const channelLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
    if(channelLink){
      const parts = channelLink.split('/').filter(Boolean)
      const idFrag = parts[parts.length-1]
      // try channel_id, then user, then @handle
      let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
      if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
      if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
      if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.6, source: 'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
    }
    // try user links
    const userLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && h.startsWith('/user/'))
    if(userLink){
      const id = userLink.split('/').pop()
      const feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(id)}`)
      if(feedResp.ok){ const out = { type: 'feed', id, feed: feedResp.json, confidence: 0.6, source: 'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
    }
    // try to find a video link
    const watchLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && h.startsWith('/watch'))
    if(watchLink){
      const m = watchLink.match(/v=([\w-]+)/)
      if(m){
        const vid = m[1]
        // get oembed to extract title/thumbnail without scraping more
        try{
          const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
          const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.7, source: 'anchor' }
          recordSuccess(backoffKey);
          setCache(cacheKey, out, 5 * 60 * 1000)
          return res.json(out)
        }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
      }
    }

    // nothing useful found — try mobile site as a fallback (sometimes markup differs)
    try{
      const mUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`
      let mres = null
      try{
        mres = await axios.get(mUrl, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 3000 })
      }catch(e){ mres = null }

      if(mres && mres.data){
        try{
          const $m = cheerio.load(mres.data)
          // mobile page: prefer channel links or watch links
          const mChannel = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
          if(mChannel){
            const parts = mChannel.split('/').filter(Boolean)
            const idFrag = parts[parts.length-1]
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
            if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.8, source: 'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
          }

          const mWatch = $m('a').toArray().map(a=>$m(a).attr('href')).find(h => h && h.startsWith('/watch'))
          if(mWatch){
            const mm = mWatch.match(/v=([\w-]+)/)
            if(mm){
              const vid = mm[1]
              try{
                const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`)
                const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.75, source: 'mobile' }
                recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out)
              }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'mobile' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
            }
          }
        }catch(e){ /* ignore parsing errors for mobile page */ }
      }

      const sampleHrefs = $('a').toArray().map(a=>$(a).attr('href')).filter(Boolean).slice(0,20)
      if(discoveryCaptureEnabled){
        console.debug(`[discover] no match for q=${q}; anchors sample:`, sampleHrefs.slice(0,10))
        // push a small debug record for developer inspection (only in memory)
        pushDiscoveryDebug({ ts: Date.now(), q, sampleHrefs: sampleHrefs.slice(0,10) })
      }else{
        console.debug(`[discover] capture disabled; skipping debug for q=${q}`)
      }
    }catch(e){ /* ignore logging errors */ }
    const out = { type: 'none', confidence: 0 }
    recordSuccess(backoffKey)
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(err){
    console.error('discover error', err && err.message)
    recordFailure(`discover:${q}`)
    return res.status(500).json({ error: 'Discovery failed' })
  }
})

// debug endpoints for discovery logs (dev-only)
app.get('/api/debug/discover', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  return res.json({ logs: discoveryDebug, enabled: discoveryCaptureEnabled })
})
app.post('/api/debug/discover/clear', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  discoveryDebug.length = 0
  return res.json({ ok: true })
})

// Append a small discovery debug event (dev-only) so clients can post failing queries/notes
app.post('/api/debug/discover/event', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  try{
    const body = req.body || {}
    const entry = { ts: Date.now(), q: body.q, note: body.note || body.reason || null, meta: body }
    pushDiscoveryDebug(entry)
    return res.json({ ok: true, entry })
  }catch(e){ return res.status(500).json({ error: 'failed' }) }
})

// Set the capture enabled flag (dev-only)
app.post('/api/debug/discover/set', (req, res)=>{
  if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'})
  const { enabled } = req.body || {}
  if(typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled boolean required' })
  discoveryCaptureEnabled = enabled
  // when enabling capture, invalidate recent discovery cache so new scrapes will run
  if(enabled){ for(const k of Array.from(cache.keys())){ if(k.startsWith('discover:')) cache.delete(k) } }
  return res.json({ ok: true, enabled: discoveryCaptureEnabled })
})

// Debug endpoints to inspect and clear backoff state (dev-only)
app.get('/api/debug/backoff', (req, res) => {
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  const out = {}
  for(const [k, v] of backoffMap.entries()){
    const remaining = getBackoffRemainingMs(k)
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(0, (v.failures || 0) - 1)), BACKOFF_MAX_MS)
    out[k] = { failures: v.failures || 0, lastErrorAt: v.lastErrorAt || 0, remainingMs: remaining, nextDelayMs: delay }
  }
  return res.json({ backoff: out })
})

app.post('/api/debug/backoff/clear', (req, res) => {
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  const { key } = req.body || {}
  if(key){
    backoffMap.delete(key)
    return res.json({ ok: true, cleared: key })
  }
  backoffMap.clear()
  return res.json({ ok: true, cleared: 'all' })
})

// Test-only: allow setting a backoff entry deterministically when TEST_FIXTURES is enabled
app.post('/api/debug/backoff/set', (req, res) => {
  console.debug('[debug/backoff/set] incoming body=', req.body)
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  if(!process.env.TEST_FIXTURES) return res.status(404).json({ error: 'not available' })
  const { key, failures = 1, lastErrorAt } = req.body || {}
  if(!key) return res.status(400).json({ error: 'key required' })
  backoffMap.set(String(key), { failures: Number(failures), lastErrorAt: Number(lastErrorAt) || Date.now() })
  console.debug('[debug/backoff/set] set', key, 'failures=', failures)
  return res.json({ ok: true, key, failures: Number(failures) })
})
console.debug('[routes] /api/debug/backoff/set registered (dev-only)')

// similar channels endpoint: given subs or keywords, find channels and return latest video per channel
app.get('/api/similar', async (req, res) => {
  const subsParam = req.query.subs // comma separated channel titles or values
  const keywordsParam = req.query.keywords
  const ttlMs = 5 * 60 * 1000

  let key
  if(subsParam) key = `similar:subs:${subsParam}`
  else if(keywordsParam) key = `similar:kw:${keywordsParam}`
  else return res.status(400).json({ error: 'subs or keywords required' })

  const cached = getCache(key)
  if(cached) return res.json(cached)

  try{
    let keywords = []
    if(keywordsParam) keywords = keywordsParam.split(',').map(s=>s.trim()).filter(Boolean)
    else if(subsParam){
      const subs = subsParam.split(',').map(s=>s.trim()).filter(Boolean)
      // extract keywords from subs' titles
      keywords = extractKeywords(subs, 8)
    }

    const foundChannels = new Map() // id -> {id, title}

    // For each keyword, fetch the YouTube results page and scrape channel links
    await Promise.all(keywords.slice(0,8).map(async (kw)=>{
      const backoffKey = `similar:kw:${kw}`
      if(getBackoffRemainingMs(backoffKey) > 0) return
      try{
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(kw)}`
        const resp = await axios.get(url, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 4000 })
        recordSuccess(backoffKey)
        const $ = cheerio.load(resp.data)
        // find channel links
        $('a').toArray().map(a=>$(a).attr('href')).forEach(h=>{
          if(!h) return
          if(h.startsWith('/channel/')){
            const id = h.split('/').filter(Boolean).pop()
            if(!foundChannels.has(id)) foundChannels.set(id, { id })
          }
          if(h.startsWith('/@')){
            const val = h.split('/').filter(Boolean).pop()
            if(val && !val.startsWith('watch')){
              // try to use as handle (we'll resolve to feed later)
              if(!foundChannels.has(val)) foundChannels.set(val, { id: val })
            }
          }
        })
      }catch(e){ recordFailure(backoffKey) /* ignore */ }
    }))

    const out = []
    // fetch feed for each channel (limit to 20)
    const entries = Array.from(foundChannels.values()).slice(0,20)
    for(const c of entries){
      try{
        // if id starts with UC, treat as channel_id
        let feedResp
        if(c.id && c.id.startsWith('UC')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(c.id)}`)
        if(!feedResp || !feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(c.id)}`)
        if(!feedResp || !feedResp.ok && !c.id.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+c.id)}`)
        if(feedResp && feedResp.ok){
          const feed = feedResp.json.feed || feedResp.json
          const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : [])
          if(entries && entries.length>0){
            const latest = entries[0]
            out.push({ channelId: c.id, channelTitle: feed.title || c.id, latestVideo: { id: latest['yt:videoId'] || latest.id?.split(':').pop(), title: latest.title, published: latest.published, thumbnail: latest['media:group']?.['media:thumbnail']?.['@_url'] || '' } })
          }
        }
      }catch(e){ /* ignore */ }
    }

    setCache(key, { channels: out }, ttlMs)
    return res.json({ channels: out })
  }catch(e){ console.error('similar error', e && e.message); return res.status(500).json({ error: 'Similar failed' }) }
})

// channel avatar endpoint (cached): fetch channel page or handle and extract og:image
app.get('/api/channel/avatar', async (req, res) => {
  const { channel_id, handle, url } = req.query
  if(!channel_id && !handle && !url) return res.status(400).json({ error: 'channel_id, handle, or url is required' })
  let fetchUrl = url
  if(channel_id) fetchUrl = `https://www.youtube.com/channel/${encodeURIComponent(channel_id)}`
  else if(handle) fetchUrl = `https://www.youtube.com/${encodeURIComponent(handle.startsWith('@')?handle:'@'+handle)}`

  const cacheKey = `avatar:${fetchUrl}`
  const cached = getCache(cacheKey)
  if(cached) return res.json(cached)

  try{
    const resp = await axios.get(fetchUrl, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 4000 })
    const $ = cheerio.load(resp.data)
    let img = $('meta[property="og:image"]').attr('content') || $('link[rel="image_src"]').attr('href')
    if(!img){
      // try to find thumbnails in JSON LD or initial data
      const scripts = $('script').toArray().map(s=>$(s).html()).filter(Boolean)
      for(const s of scripts){
        const m = s.match(/"avatar"\s*:\s*\{"thumbnails"\s*:\s*\[\{"url"\s*:\s*"([^"]+)"/)
        if(m){ img = m[1]; break }
      }
    }
    const out = { thumbnail: img || null }
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(e){ console.error('avatar fetch failed', e && e.message); return res.status(200).json({ thumbnail: null }) }
})

// health endpoint
app.get('/api/health', (req, res)=>{
  return res.json({ ok: true, routes: ['feed','search','discover','similar','channel/avatar','debug'] })
})

// Ensure API routes return JSON 404 instead of HTML to make client handling deterministic
app.use('/api', (req, res)=>{
  return res.status(404).json({ error: 'not found' })
})

// Export app for testing, only start server when run directly
const PORT = process.env.PORT || 4000
if(require.main === module){
  app.listen(PORT, ()=> console.log(`CORS proxy listening on ${PORT}`))
}

module.exports = app
