/* Cloudflare Workers-compatible handler for a subset of the API.
   - Provides `/api/health`, `/api/feed`, `/api/search` and `/api/discover` (best-effort).
   - Uses global `fetch` and lightweight parsing (no cheerio). This is intended to be deployable to Cloudflare Workers / Pages Functions.

   Note: behavior intentionally mirrors the Node server but is kept small and stateless so it can run at the edge.
*/
import { XMLParser } from 'fast-xml-parser'

type JSONValue = any

async function fetchText(url: string, timeoutMs = 5000){
  const controller = new AbortController()
  const id = setTimeout(()=>controller.abort(), timeoutMs)
  try{
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
    clearTimeout(id)
    if(!r.ok) throw new Error(`fetch ${r.status}`)
    return await r.text()
  }finally{ clearTimeout(id) }
}

async function tryFeedUrl(url: string){
  try{
    const txt = await fetchText(url)
    const parser = new XMLParser({ ignoreAttributes: false })
    return { ok: true, json: parser.parse(txt) }
  }catch(e){ return { ok: false, err: String(e) } }
}

function makeJSON(status: number, body: JSONValue){ return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) }

export default {
  async fetch(request: Request){
    const url = new URL(request.url)
    const path = url.pathname

    if(path === '/api/health') return makeJSON(200, { ok: true })

    // /api/feed?channel_id=... or ?user=...
    if(path === '/api/feed'){
      const channelId = url.searchParams.get('channel_id')
      const user = url.searchParams.get('user')
      if(!channelId && !user) return makeJSON(400, { error: 'channel_id or user is required' })
      if(channelId){
        const candidates = [
          `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
          `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(channelId)}`,
          `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+channelId)}`,
        ]
        for(const c of candidates){
          const r = await tryFeedUrl(c)
          if(r.ok) return makeJSON(200, r.json)
        }
        return makeJSON(404, { error: `No feed found for '${channelId}'` })
      }
      if(user){
        const r = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(user)}`)
        if(r.ok) return makeJSON(200, r.json)
        const r2 = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent('@'+user)}`)
        if(r2.ok) return makeJSON(200, r2.json)
        return makeJSON(404, { error: `No feed found for user '${user}'` })
      }
    }

    // /api/search?q=...&quick=1
    if(path === '/api/search'){
      const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
      if(!q) return makeJSON(400, { error: 'query is required' })
      const quick = url.searchParams.get('quick') === '1' || url.searchParams.get('quick') === 'true'
      if(quick){
        try{
          const feed = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`)
          return makeJSON(200, feed.ok ? feed.json : { feed: { title: 'No results', entry: [] } })
        }catch(e){ return makeJSON(200, { feed: { title: 'No results', entry: [] } }) }
      }
      // attempt search -> feed fallback
      const searchResp = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(q)}`)
      if(searchResp.ok) return makeJSON(200, searchResp.json)
      const feedResp = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(q)}`)
      if(feedResp.ok) return makeJSON(200, feedResp.json)
      const feedResp2 = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(q)}`)
      if(feedResp2.ok) return makeJSON(200, feedResp2.json)
      return makeJSON(200, { feed: { title: 'No results', entry: [] } })
    }

    // /api/discover?q=...&aggressive=1
    if(path === '/api/discover'){
      const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
      const aggressive = (url.searchParams.get('aggressive') || '').toLowerCase() === '1' || (url.searchParams.get('aggressive') || '').toLowerCase() === 'true'
      if(!q) return makeJSON(400, { error: 'query is required' })

      // aggressive: try mobile first
      if(aggressive){
        try{
          const m = await fetchText(`https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`, 3000)
          const href = m.match(/href="(\/channel\/[^"]+)"/) || m.match(/href="(\/user\/[^"]+)"/) || m.match(/href="(\/watch\?[^"]+)"/)
          if(href){
            const hrefStr = href[1]
            if(hrefStr.startsWith('/channel/') || hrefStr.startsWith('/user/')){
              const idFrag = hrefStr.split('/').pop() || ''
              const feed = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
              if(feed.ok) return makeJSON(200, { type: 'feed', id: idFrag, feed: feed.json, confidence: 0.8, source: 'mobile' })
            }
            if(hrefStr.startsWith('/watch')){
              const mvid = hrefStr.match(/v=([\w-]+)/)
              if(mvid){ return makeJSON(200, { type: 'video', id: mvid[1], confidence: 0.75, source: 'mobile' }) }
            }
          }
        }catch(e){ /* fallthrough */ }
      }

      // desktop results: try to extract ytInitialData JSON or fall back to anchor regex
      try{
        const page = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`)
        // try to find ytInitialData via string search
        const { parseYtInitialData } = await import('./shared/parsers.ts')
        const parsed = parseYtInitialData(page)
        if (parsed && parsed.channelId) {
          const idFrag = parsed.channelId
          const feed = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
          if (feed.ok) return makeJSON(200, { type: 'feed', id: idFrag, feed: feed.json, confidence: 0.95, source: 'ytInitialData' })
        }
        if (parsed && parsed.videoId) {
          return makeJSON(200, { type: 'video', id: parsed.videoId, confidence: 0.95, source: 'ytInitialData' })
        }

        // fallback: use shared anchor extractor
        const { extractFromAnchors } = await import('./shared/parsers.ts')
        const anchorParsed = extractFromAnchors(page)
        if (anchorParsed && anchorParsed.channelId) {
          const idFrag = anchorParsed.channelId
          const feed = await tryFeedUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(idFrag)}`)
          if (feed.ok) return makeJSON(200, { type: 'feed', id: idFrag, feed: feed.json, confidence: 0.6, source: 'anchor' })
        }
        if (anchorParsed && anchorParsed.videoId) {
          return makeJSON(200, { type: 'video', id: anchorParsed.videoId, confidence: 0.7, source: 'anchor' })
        }
      }catch(e){ /* ignore */ }

      return makeJSON(200, { type: 'none', confidence: 0 })
    }

    // fallback 404 for unknown paths
    return makeJSON(404, { error: 'not found' })
  }
}
