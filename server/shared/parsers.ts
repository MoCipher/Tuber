// Lightweight HTML parsers shared between server and edge worker.
// Pure string-based logic so it can run in Node *and* Cloudflare Workers.

export type ParseResult = {
  channelId?: string
  videoId?: string
}

// Try to extract a channelId or videoId from an embedded ytInitialData JSON blob.
export function parseYtInitialData(html: string): ParseResult | null {
  // prefer a non-greedy regex to capture the JSON blob after ytInitialData
  const regex = /ytInitialData\s*=\s*(\{[\s\S]*?\})/m
  const match = html.match(regex)
  let candidate: string | null = null
  if (match && match[1]) {
    candidate = match[1]
  } else {
    // fallback: brace-walking when regex misses (legacy behavior)
    const idx = html.indexOf('ytInitialData')
    if (idx === -1) return null
    const start = html.indexOf('{', idx)
    if (start === -1) return null

    let depth = 0
    let end = -1
    for (let i = start; i < html.length; i++) {
      const ch = html[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    if (end === -1) return null
    candidate = html.slice(start, end + 1)
  }
  try {
    // debug: help trace parsing failures during migration/tests
    // (kept lightweight; removed once stable)
    // console.debug('[parsers] candidate.length', candidate.length)
    const j = JSON.parse(candidate)
    // DEBUG -- temporary: dump candidate and top-level keys when tests fail
    console.log('[parsers] candidate startsWith', candidate.slice(0,80))
    // recursive search for renderer objects
    function findRenderer(obj: any, key: string): any | null {
      if (!obj || typeof obj !== 'object') return null
      if (obj[key]) return obj[key]
      for (const k of Object.keys(obj)) {
        try {
          const r = findRenderer(obj[k], key)
          if (r) return r
        } catch (e) {}
      }
      return null
    }
    const ch = findRenderer(j, 'channelRenderer')
    if (ch && ch.channelId) {
      // console.log('[parsers] found channelRenderer', ch.channelId)
      return { channelId: String(ch.channelId) }
    }
    const v = findRenderer(j, 'videoRenderer')
    if (v && v.videoId) {
      // console.log('[parsers] found videoRenderer', v.videoId)
      return { videoId: String(v.videoId) }
    }
  } catch (e) {
    // console.debug('[parsers] json parse failed', e && e.message)
    return null
  }
  return null
}

// Scan anchor hrefs in the HTML and return the first channel/user or video id found.
export function extractFromAnchors(html: string): ParseResult | null {
  const hrefs: string[] = []
  const re = /href\s*=\s*"([^"]+)"/g
  let m
  while ((m = re.exec(html)) !== null) hrefs.push(m[1])

  for (const h of hrefs) {
    if (h.startsWith('/channel/') || h.startsWith('/user/') || h.startsWith('/@') || h.startsWith('/c/')) {
      const parts = h.split('/').filter(Boolean)
      const idFrag = parts[parts.length - 1]
      if (idFrag) return { channelId: idFrag }
    }
    if (h.startsWith('/watch')) {
      const mm = h.match(/v=([\w-]+)/)
      if (mm) return { videoId: mm[1] }
    }
  }
  return null
}
