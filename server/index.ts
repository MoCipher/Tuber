import express from 'express'
import axios from './http-shim.js'
import { XMLParser } from 'fast-xml-parser'
import * as cheerio from 'cheerio'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

// In-memory discovery debug buffer (dev-only, capped)
const DISCOVERY_DEBUG_LIMIT = 50
const discoveryDebug: any[] = []
let discoveryCaptureEnabled = true // runtime toggle

// TEST fixture store (populated by tests when TEST_FIXTURES=1)
const TEST_FIXTURE_STORE: Record<string, any> = {}

// Simple in-memory cache with TTL
const cache = new Map<string, { ts: number, ttl: number, val: any }>()
function setCache(key: string, val: any, ttlMs: number){ cache.set(key, { ts: Date.now(), ttl: ttlMs, val }) }
function getCache(key: string){ const e = cache.get(key); if(!e) return null; if(Date.now() - e.ts > e.ttl) { cache.delete(key); return null } return e.val }

// Backoff map for per-query exponential backoff to avoid aggressive scraping
const BACKOFF_BASE_MS = 5000
const BACKOFF_MAX_MS = 5 * 60 * 1000
const backoffMap = new Map<string, { failures?: number, lastErrorAt?: number }>()

function getBackoffRemainingMs(key: string){
  const s = backoffMap.get(key)
  if(!s || !s.lastErrorAt) return 0
  if((s.failures || 0) < 2) return 0
  const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(0, (s.failures || 0) - 1)), BACKOFF_MAX_MS)
  const elapsed = Date.now() - (s.lastErrorAt || 0)
  return delay > elapsed ? (delay - elapsed) : 0
}
function recordFailure(key: string){ const s = backoffMap.get(key) || { failures: 0, lastErrorAt: 0 }; s.failures = (s.failures || 0) + 1; s.lastErrorAt = Date.now(); backoffMap.set(key, s) }
function recordSuccess(key: string){ backoffMap.delete(key) }

function pushDiscoveryDebug(entry: any){ try{ discoveryDebug.push(entry); if(discoveryDebug.length > DISCOVERY_DEBUG_LIMIT) discoveryDebug.shift() }catch(e){} }

async function tryFeed(url: string){
  try{
    const resp = await axios.get(url, { responseType: 'text' })
    const parser = new XMLParser({ ignoreAttributes: false })
    return { ok: true, json: parser.parse(resp.data) }
  }catch(err){ return { ok: false, err } }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/feed', async (req, res) => {
  let channelId = req.query.channel_id as string | undefined
  let user = req.query.user as string | undefined

  // Normalize URL-like inputs so callers may pass full channel/user URLs.
  // Examples handled: https://www.youtube.com/channel/UC... | /c/name | /@handle | raw username
  function normalizeIdentifier(v?: string){
    if(!v) return v
    try{
      if(String(v).startsWith('http') || String(v).includes('/')){
        const u = new URL(String(v))
        const parts = u.pathname.split('/').filter(Boolean)
        if(parts.length) return parts[parts.length-1]
      }
    }catch(e){
      const parts = String(v).split('/').filter(Boolean)
      if(parts.length) return parts[parts.length-1]
    }
    return v
  }
  channelId = normalizeIdentifier(channelId)
  user = normalizeIdentifier(user)

  if(!channelId && !user) return res.status(400).json({error:'channel_id or user is required'})
  try{
    // TEST FIXTURES: allow tests to stub feeds directly
    if(process.env.TEST_FIXTURES === '1'){
      if(channelId){ const stored = TEST_FIXTURE_STORE[`feed:${channelId}`]; if(stored) return res.json(stored) }
      if(user){ const stored = TEST_FIXTURE_STORE[`feed:${user}`]; if(stored) return res.json(stored) }
    }

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
  }catch(err){ console.error(err); res.status(500).json({error: 'Unexpected error'}) }
})

app.get('/api/channel/avatar', async (req, res) => {
  const channelId = req.query.channel_id as string | undefined
  const handle = req.query.handle as string | undefined
  if(!channelId && !handle) return res.status(400).json({ error: 'channel_id or handle required' })
  try{
    const url = channelId ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}` : `https://www.youtube.com/${encodeURIComponent(handle)}`
    const r = await axios.get(url, { responseType: 'text' })
    const $ = cheerio.load(r.data)
    const og = $('meta[property="og:image"]').attr('content') || null
    // DEBUG: inspect fetched HTML and extracted OG (removed after debugging)
    console.log('[channel/avatar] fetched url=', url, 'og=', og)
    return res.json({ thumbnail: og || null })
  }catch(e){ return res.json({ thumbnail: null }) }
})

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || req.query.query || '')
  if(!q) return res.status(400).json({ error: 'query is required' })

  // TEST FIXTURES: when TEST_FIXTURES=1 allow tests to override responses
  if(process.env.TEST_FIXTURES === '1'){
    try{
      const stored = TEST_FIXTURE_STORE[`search:${q}`] || TEST_FIXTURE_STORE[`search:${q}`]
      if(stored) return res.json(stored)

      // fallback to static fixture file matching common queries (compat)
      if(q === 'cats'){
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fixture = require('./test/fixtures/search-cats.json')
        return res.json(fixture)
      }

      // default empty fixture
      return res.json({ feed: { title: 'No results', entry: [] } })
    }catch(e){ console.error('[server] fixture error', e); /* fall through to normal handling */ }
  }

  if(req.query.quick === '1' || req.query.quick === 'true'){
    try{ const searchUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`; const resp = await axios.get(searchUrl, { responseType: 'text' }); const parser = new XMLParser({ ignoreAttributes: false }); const json = parser.parse(resp.data); return res.json(json) }catch(e){ return res.json({ feed: { title: 'No results', entry: [] } }) }
  }
  const cacheKey = `search:${q}`
  const cached = getCache(cacheKey)
  if(cached) return res.json(cached)
  async function tryUrl(u: string){ try{ const resp = await axios.get(u, { responseType: 'text' }); const parser = new XMLParser({ ignoreAttributes: false }); return { ok: true, json: parser.parse(resp.data) } }catch(err){ return { ok: false, err } } }
  try{
    const searchPromise = (async ()=>{ const searchUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`; const resp = await tryUrl(searchUrl); return resp.ok ? {type:'search', data: resp.json} : null })()
    const feedFallbackPromise = (async ()=>{ const asUser = await tryUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(q)}`); if(asUser.ok) return {type:'feed', data: asUser.json}; const asHandle = await tryUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+q)}`); if(asHandle.ok) return {type:'feed', data: asHandle.json}; const asChannel = await tryUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(q)}`); if(asChannel.ok) return {type:'feed', data: asChannel.json}; return null })()
    const discoverPromise = (async ()=>{ try{ const backoffKey = `discover:${q}`; if(getBackoffRemainingMs(backoffKey) > 0) return null; const controller = new AbortController(); const id = setTimeout(()=>controller.abort(), 3000); const dres = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' }, signal: controller.signal }); clearTimeout(id); const $ = cheerio.load(dres.data); const channelLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/'))); if(channelLink){ const parts = channelLink.split('/').filter(Boolean); const idFrag = parts[parts.length-1]; const feedResp = await tryUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`); if(feedResp.ok){ recordSuccess(backoffKey); return {type:'feed', data: feedResp.json} } } return null }catch(e){ recordFailure(`discover:${q}`); return null } })()
    const results = await Promise.allSettled([searchPromise, feedFallbackPromise, discoverPromise])
    let chosen: any = null
    let bestConf = -1
    for(const settled of results){
      if(settled.status !== 'fulfilled') continue
      const r = (settled as PromiseFulfilledResult<any>).value
      if(!r) continue
      if(r.type === 'feed'){
        const feed = r.data.feed || r.data
        const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : [])
        const conf = (r.data && typeof r.data.confidence === 'number') ? r.data.confidence : 0.5
        if(entries && entries.length>0 && conf > bestConf){ chosen = r.data; bestConf = conf }
      }
    }
    if(!chosen){
      for(const settled of results){
        if(settled.status !== 'fulfilled') continue
        const v = (settled as PromiseFulfilledResult<any>).value
        if(v && v.type === 'search'){ chosen = v.data; break }
      }
    }
    const out = chosen || { feed: { title: 'No results', entry: [] } }
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(err){ console.error('search error', err && err.message); return res.status(500).json({error: 'Search feed failed'}) }
})

app.get('/api/discover', async (req, res) => {
  const q = String(req.query.q || req.query.query || '')
  const aggressive = String(req.query.aggressive || '').toLowerCase() === '1' || String(req.query.aggressive || '').toLowerCase() === 'true'
  if(!q) return res.status(400).json({ error: 'query is required' })

  const backoffKey = `discover:${q}`
  const remaining = getBackoffRemainingMs(backoffKey)
  if(remaining > 0 && !aggressive){
    // honor explicit backoff even if a cached discovery exists
    return res.status(429).json({ error: 'backoff', retryAfterMs: Math.ceil(remaining) })
  }

  // TEST fixtures override (only after honoring backoff)
  if(process.env.TEST_FIXTURES === '1'){
    const stored = TEST_FIXTURE_STORE[`discover:${q}`]
    if(stored) return res.json(stored)
  }

  const cacheKey = `discover:${q}`
  const cached = getCache(cacheKey)
  if(cached && !aggressive) return res.json(cached)

  try{
    if (aggressive) {
      try {
        const mUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`
        const mres = await axios.get(mUrl, { responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3000 })

        if (mres && mres.data) {
          const $m = cheerio.load(mres.data)

          // look for channel links first
          const anchors = $m('a').toArray().map(a => $m(a).attr('href')).filter(Boolean)
          const mChannel = anchors.find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
          if (mChannel) {
            const parts = mChannel.split('/').filter(Boolean)
            const idFrag = parts[parts.length - 1]
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if (!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if (!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@' + idFrag)}`)
            if (feedResp.ok) {
              const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.8, source: 'mobile' }
              recordSuccess(backoffKey)
              setCache(cacheKey, out, 5 * 60 * 1000)
              return res.json(out)
            }
          }

          // then try watch links
          const mWatch = anchors.find(h => h && h.startsWith('/watch'))
          if (mWatch) {
            const mm = mWatch.match(/v=([\w-]+)/)
            if (mm) {
              const vid = mm[1]
              try {
                const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + vid)}&format=json`)
                const out = { type: 'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.75, source: 'mobile' }
                recordSuccess(backoffKey)
                setCache(cacheKey, out, 5 * 60 * 1000)
                return res.json(out)
              } catch (e) {
                const out = { type: 'video', id: vid, confidence: 0.6, source: 'mobile' }
                recordSuccess(backoffKey)
                setCache(cacheKey, out, 5 * 60 * 1000)
                return res.json(out)
              }
            }
          }
        }
      } catch (e) {
        /* ignore mobile parse errors */
      }
    }
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    const resp = await axios.get(url, { responseType: 'text', headers: { 'User-Agent':'Mozilla/5.0' } })
    const $ = cheerio.load(resp.data)
    try{
      const scriptHtml = $('script').toArray().map(s=>$(s).html()).filter(Boolean).join('\n')
      // lightweight log (use console.log so tests relying on console.debug remain stable)
      console.log('[discover] scriptHtml snippet length=', scriptHtml.length)
      // use shared HTML parsers
      console.log('[discover] importing shared parsers')
      let parseYtInitialData: any = null
      let extractFromAnchors: any = null
      try {
        const parsers = await import('./shared/parsers.ts')
        console.log('[discover] parsers loaded keys=', Object.keys(parsers))
        parseYtInitialData = parsers.parseYtInitialData
        extractFromAnchors = parsers.extractFromAnchors
      } catch (err) {
        console.error('[discover] failed to import shared/parsers:', err && err.message)
      }

      let parsed = null
      try { parsed = parseYtInitialData ? parseYtInitialData(resp.data) : null } catch(e) { parsed = null }
      // quick regex fallback (helps tests that inject a small ytInitialData var)
      if(!parsed && scriptHtml){
        const m = scriptHtml.match(/channelRenderer[\s\S]*?channelId[^:\n\r]*[:\s\"]+([A-Za-z0-9_\-@]+)/i)
        if(m) parsed = { channelId: m[1] }
      }
      if(!parsed) parsed = extractFromAnchors ? extractFromAnchors(resp.data) : null
      console.log('[discover] parsed ->', parsed)
      if(parsed && parsed.channelId){
        const idFrag = parsed.channelId
        let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
        if(!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
        if(!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+idFrag)}`)
        if(feedResp.ok){ const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.95, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
      }
      if(parsed && parsed.videoId){
        const vid = parsed.videoId
        try{ const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`); const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.95, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }catch(e){ const out = { type:'video', id: vid, confidence: 0.9, source: 'ytInitialData' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }
      }
    }catch(e){}
    const userLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && h.startsWith('/user/'))
    if(userLink){ const id = userLink.split('/').pop(); const feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(id)}`); if(feedResp.ok){ const out = { type: 'feed', id, feed: feedResp.json, confidence: 0.6, source: 'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) } }
    const watchLink = $('a').toArray().map(a=>$(a).attr('href')).find(h => h && h.startsWith('/watch'))
    if(watchLink){ const m = watchLink.match(/v=([\w-]+)/); if(m){ const vid = m[1]; try{ const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+vid)}&format=json`); const out = { type:'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.7, source: 'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) }catch(e){ const out = { type:'video', id: vid, confidence:0.6, source:'anchor' }; recordSuccess(backoffKey); setCache(cacheKey, out, 5 * 60 * 1000); return res.json(out) } } }
    try {
      const mUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`
      let mres = null
      try {
        mres = await axios.get(mUrl, { responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3000 })
      } catch (e) {
        mres = null
      }

      if (mres && mres.data) {
        try {
          const $m = cheerio.load(mres.data)
          const anchors = $m('a').toArray().map(a => $m(a).attr('href')).filter(Boolean)

          const mChannel = anchors.find(h => h && (h.startsWith('/channel/') || h.startsWith('/@') || h.startsWith('/c/')))
          if (mChannel) {
            const parts = mChannel.split('/').filter(Boolean)
            const idFrag = parts[parts.length - 1]
            let feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
            if (!feedResp.ok) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(idFrag)}`)
            if (!feedResp.ok && !idFrag.startsWith('@')) feedResp = await tryFeed(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@' + idFrag)}`)
            if (feedResp.ok) {
              const out = { type: 'feed', id: idFrag, feed: feedResp.json, confidence: 0.8, source: 'mobile' }
              recordSuccess(backoffKey)
              setCache(cacheKey, out, 5 * 60 * 1000)
              return res.json(out)
            }
          }

          const mWatch = anchors.find(h => h && h.startsWith('/watch'))
          if (mWatch) {
            const mm = mWatch.match(/v=([\w-]+)/)
            if (mm) {
              const vid = mm[1]
              try {
                const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + vid)}&format=json`)
                const out = { type: 'video', id: vid, title: oe.data.title, thumbnail: oe.data.thumbnail_url, confidence: 0.75, source: 'mobile' }
                recordSuccess(backoffKey)
                setCache(cacheKey, out, 5 * 60 * 1000)
                return res.json(out)
              } catch (e) {
                const out = { type: 'video', id: vid, confidence: 0.6, source: 'mobile' }
                recordSuccess(backoffKey)
                setCache(cacheKey, out, 5 * 60 * 1000)
                return res.json(out)
              }
            }
          }
        } catch (e) {
          /* ignore mobile parse errors */
        }
      }
    } catch (e) {
      /* ignore logging errors */
    }
      const sampleHrefs = $('a').toArray().map(a=>$(a).attr('href')).filter(Boolean).slice(0,20)
      if(discoveryCaptureEnabled){
        console.debug(`[discover] no match for q=${q}; anchors sample:`, sampleHrefs.slice(0,10))
        pushDiscoveryDebug({ ts: Date.now(), q, sampleHrefs: sampleHrefs.slice(0,10) })
      } else {
        console.debug(`[discover] capture disabled; skipping debug for q=${q}`)
      }
    const out = { type: 'none', confidence: 0 }
    recordSuccess(backoffKey)
    setCache(cacheKey, out, 5 * 60 * 1000)
    return res.json(out)
  }catch(err){ console.error('discover error', err && err.message); recordFailure(`discover:${q}`); return res.status(500).json({ error: 'Discovery failed' }) }
})

app.get('/api/debug/discover', (req, res)=>{ if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'}); return res.json({ logs: discoveryDebug, enabled: discoveryCaptureEnabled }) })
app.post('/api/debug/discover/clear', (req, res)=>{ if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'}); discoveryDebug.length = 0; return res.json({ ok: true }) })
app.post('/api/debug/discover/event', (req, res)=>{ if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'}); try{ const body = req.body || {}; const entry = { ts: Date.now(), q: body.q, note: body.note || body.reason || null, meta: body }; pushDiscoveryDebug(entry); return res.json({ ok: true, entry }) }catch(e){ return res.status(500).json({ error: 'failed' }) } })
app.post('/api/debug/discover/set', (req, res)=>{ if(process.env.NODE_ENV === 'production') return res.status(404).json({error:'not found'}); const { enabled } = req.body || {}; if(typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled boolean required' }); discoveryCaptureEnabled = enabled; if(enabled){ for(const k of Array.from(cache.keys())){ if(k.startsWith('discover:')) cache.delete(k) } } return res.json({ ok: true, enabled: discoveryCaptureEnabled }) })
app.get('/api/debug/backoff', (req, res) => { if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' }); const out: any = {}; for(const [k, v] of backoffMap.entries()){ const remaining = getBackoffRemainingMs(k); const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(0, (v.failures || 0) - 1)), BACKOFF_MAX_MS); out[k] = { failures: v.failures || 0, lastErrorAt: v.lastErrorAt || 0, remainingMs: remaining, nextDelayMs: delay } } return res.json({ backoff: out }) })
app.post('/api/debug/backoff/clear', (req, res) => { if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' }); const { key } = req.body || {}; if(key){ backoffMap.delete(key); return res.json({ ok: true, cleared: key }) } backoffMap.clear(); return res.json({ ok: true, cleared: 'all' }) })
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

// Test-only: install / inspect server fixtures when TEST_FIXTURES=1
app.post('/api/__fixtures', (req, res) => {
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  if(!process.env.TEST_FIXTURES) return res.status(404).json({ error: 'not available' })
  const { type, q, response } = req.body || {}
  if(!type || typeof q === 'undefined') return res.status(400).json({ error: 'type and q required' })
  const key = `${String(type)}:${String(q)}`
  TEST_FIXTURE_STORE[key] = response

  // If the fixture contains a feed (discover -> { type:'feed', id, feed }), also register it
  // so /api/feed?channel_id=<id> will return deterministic data in TEST_FIXTURES mode.
  try{
    if(response && response.type === 'feed' && response.id){
      TEST_FIXTURE_STORE[`feed:${String(response.id)}`] = response.feed || response
    }
  }catch(e){}

  // clear any cached entries so fixture takes effect immediately
  cache.delete(`search:${q}`)
  cache.delete(`discover:${q}`)
  cache.delete(`feed:${q}`)
  setCache(`${type}:${q}`, response, 5 * 60 * 1000)
  console.debug('[__fixtures] set', key)
  return res.json({ ok: true, key })
})

app.get('/api/__fixtures', (req, res) => {
  if(process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
  if(!process.env.TEST_FIXTURES) return res.status(404).json({ error: 'not available' })
  return res.json({ fixtures: TEST_FIXTURE_STORE })
})

app.get('/api/similar', async (req, res) => {
  const subsParam = req.query.subs
  const keywordsParam = req.query.keywords
  const ttlMs = 5 * 60 * 1000
  let key
  if(subsParam) key = `similar:subs:${subsParam}`
  else if(keywordsParam) key = `similar:kw:${keywordsParam}`
  const cached = key ? getCache(key) : null
  if(cached) return res.json(cached)
  try{
    const urls: string[] = []
    if(keywordsParam){ const kws = String(keywordsParam).split(/[,\s]+/).filter(Boolean); for(const k of kws.slice(0,3)){ urls.push(`https://www.youtube.com/results?search_query=${encodeURIComponent(k)}`) } }
    const channels: any[] = []
    for(const u of urls){ try{ const r = await axios.get(u, { responseType: 'text' }); const $ = cheerio.load(r.data); const found = $('a').toArray().map(a=>$(a).attr('href')).filter(Boolean).filter(h=>h.startsWith('/channel/')).slice(0,5); for(const f of found){ const id = f.split('/').filter(Boolean).pop(); channels.push({ channelId: id, channelTitle: id }) } }catch(e){} }
    const out = { channels }
    if(key) setCache(key, out, ttlMs)
    return res.json(out)
  }catch(e){ return res.status(500).json({ error: 'similar failed' }) }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use((_req, res)=> res.status(404).json({ error: 'not found' }))

export default app

// Start server when executed directly (supports CommonJS require.main and ts-node/ESM cases)
const _isEntry = (typeof require !== 'undefined' && require.main === module) || (process.argv && process.argv[1] && (process.argv[1].endsWith('server/index.ts') || process.argv[1].endsWith('server/index.js')))
if(_isEntry){ const port = process.env.PORT || 4000; app.listen(port, ()=> console.log('Server listening on', port)) }

// Also export handlers for potential edge deployments (worker adapter can import these later)
export const _internal = {
  tryFeed,
  getCache,
  setCache,
  getBackoffRemainingMs,
  recordFailure,
  recordSuccess,
  pushDiscoveryDebug,
}
