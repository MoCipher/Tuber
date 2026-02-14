const request = require('supertest')
const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const app = require('../index.ts').default || require('../index.ts')

const sampleSearchXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Search results</title>
  <entry>
    <id>yt:video:AAA</id>
    <yt:videoId>AAA</yt:videoId>
    <title>Result One</title>
    <published>2026-02-10T00:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://example.com/thumb1.jpg"/>
    </media:group>
  </entry>
</feed>`

describe('GET /api/search', ()=>{
  let stub
  afterEach(()=>{ if(stub) stub.restore() })

  it('returns results for search query', async ()=>{
    stub = sinon.stub(axios, 'get').resolves({ data: sampleSearchXml })
    const res = await request(app).get('/api/search').query({ q: 'test' })
    expect(res.status).to.equal(200)
    expect(res.body.feed).to.exist
    expect(res.body.feed.title).to.include('Search')
  })

  it('falls back to user feed when search returns 404', async ()=>{
    // first call to search will fail, second call to user feed will succeed
    let count = 0
    stub = sinon.stub(axios, 'get').callsFake(()=>{
      count++
      if(count===1) return Promise.reject(new Error('search fail'))
      return Promise.resolve({ data: sampleSearchXml })
    })
    const res = await request(app).get('/api/search').query({ q: 'pewdiepie' })
    expect(res.status).to.equal(200)
    expect(res.body.feed).to.exist
    expect(res.body.feed.title).to.exist
  })

  it('returns empty feed when nothing found', async ()=>{
    stub = sinon.stub(axios, 'get').rejects(new Error('not found'))
    const res = await request(app).get('/api/search').query({ q: 'missing' })
    expect(res.status).to.equal(200)
    expect(res.body.feed).to.exist
    expect(res.body.feed.entry).to.exist
    expect(res.body.feed.entry).to.be.an('array').that.is.empty
  })

  it('discovers a channel or video from YouTube HTML', async ()=>{
    // stub out axios for discovery: return a simple HTML with a channel link in ytInitialData JSON
    const ytJson = JSON.stringify({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [ { itemSectionRenderer: { contents: [ { channelRenderer: { channelId: 'UCABC', title: { simpleText: 'Test Channel' } } } ] } } ] } } } } })
    stub = sinon.stub(axios, 'get').callsFake((u)=>{
      if(u.includes('results?') && u.includes('m.youtube.com') === false){
        return Promise.resolve({ data: `<html><body><script>var ytInitialData = ${ytJson};</script></body></html>` })
      }
      if(u.includes('feeds/videos.xml?channel_id=')){
        return Promise.resolve({ data: '<?xml version="1.0"?><feed><title>Channel feed</title><entry></entry></feed>' })
      }
      return Promise.reject(new Error('unknown'))
    })
    const res = await request(app).get('/api/discover').query({ q: 'any' })
    expect(res.status).to.equal(200)
    expect(res.body.type).to.equal('feed')
    expect(res.body.id).to.equal('UCABC')
  })

  it('falls back to mobile discovery when desktop result lacks data (and honors aggressive flag)', async ()=>{
    // desktop returns minimal HTML without channel info, mobile returns a channel link
    stub = sinon.stub(axios, 'get').callsFake((u)=>{
      if(u.includes('m.youtube.com/results')){
        return Promise.resolve({ data: '<html><body><a href="/channel/UCMOBILE">MobileChannel</a></body></html>' })
      }
      if(u.includes('results?') && u.includes('m.youtube.com') === false){
        return Promise.resolve({ data: '<html><body><div>No results here</div></body></html>' })
      }
      if(u.includes('feeds/videos.xml?channel_id=UCMOBILE')){
        return Promise.resolve({ data: '<?xml version="1.0"?><feed><title>Mobile Channel feed</title><entry></entry></feed>' })
      }
      return Promise.reject(new Error('unknown '+u))
    })
    // aggressive should trigger mobile-first behavior; server already falls back to mobile, but ensure aggressive param is accepted
    const res = await request(app).get('/api/discover').query({ q: 'mobile', aggressive: '1' })
    expect(res.status).to.equal(200)
    expect(res.body.type).to.equal('feed')
    expect(res.body.id).to.equal('UCMOBILE')
    expect(res.body.confidence).to.equal(0.8)
  })

  it('returns similar channels for keywords/subs', async ()=>{
    // stub pages for keyword search and feeds
    let count = 0
    stub = sinon.stub(axios, 'get').callsFake((u)=>{
      if(u.includes('results?')){
        // for keyword searches return HTML containing a channel link
        return Promise.resolve({ data: '<html><body><a href="/channel/UC111">Ch1</a><a href="/channel/UC222">Ch2</a></body></html>' })
      }
      if(u.includes('feeds/videos.xml?channel_id=UC111')){
        return Promise.resolve({ data: '<?xml version="1.0"?><feed><title>Ch1</title><entry><id>yt:video:V111</id><yt:videoId>V111</yt:videoId><title>Video111</title><published>2026-02-11T00:00:00+00:00</published></entry></feed>' })
      }
      if(u.includes('feeds/videos.xml?channel_id=UC222')){
        return Promise.resolve({ data: '<?xml version="1.0"?><feed><title>Ch2</title><entry><id>yt:video:V222</id><yt:videoId>V222</yt:videoId><title>Video222</title><published>2026-02-10T00:00:00+00:00</published></entry></feed>' })
      }
      return Promise.reject(new Error('unknown'))
    })
    const res = await request(app).get('/api/similar').query({ keywords: 'music,tech' })
    expect(res.status).to.equal(200)
    expect(res.body.channels).to.be.an('array')
    expect(res.body.channels.length).to.be.greaterThan(0)
    expect(res.body.channels[0]).to.have.property('channelId')
  })

  it('returns none and logs sample anchors when discovery finds nothing', async ()=>{
    let axiosStub = sinon.stub(axios, 'get').callsFake((u)=>{
      if(u.includes('results?')){
        return Promise.resolve({ data: '<html><body><a href="/about">About</a><a href="/contact">Contact</a></body></html>' })
      }
      return Promise.reject(new Error('not found'))
    })
    const debugStub = sinon.stub(console, 'debug')
    const res = await request(app).get('/api/discover').query({ q: 'missing' })
    expect(res.status).to.equal(200)
    expect(res.body.type).to.equal('none')
    sinon.assert.calledOnce(debugStub)
    // ensure debug message contains query and sample anchors
    sinon.assert.calledWithMatch(debugStub, sinon.match.string, sinon.match.array)

    // Now call the debug endpoint to retrieve stored logs
    const dbg = await request(app).get('/api/debug/discover')
    expect(dbg.status).to.equal(200)
    expect(dbg.body.logs).to.be.an('array')
    expect(dbg.body.enabled).to.equal(true)
    expect(dbg.body.logs.length).to.be.greaterThan(0)
    const entry = dbg.body.logs[dbg.body.logs.length - 1]
    expect(entry).to.have.property('q', 'missing')
    expect(entry).to.have.property('sampleHrefs')

    // now disable capture and confirm new missing discovery does not append
    const off = await request(app).post('/api/debug/discover/set').send({ enabled: false })
    expect(off.status).to.equal(200)
    expect(off.body.enabled).to.equal(false)
    // trigger another discover (should not be logged)
    const res2 = await request(app).get('/api/discover').query({ q: 'missing' })
    expect(res2.status).to.equal(200)
    const dbg3 = await request(app).get('/api/debug/discover')
    expect(dbg3.body.enabled).to.equal(false)
    // logs should be unchanged from previous length
    expect(dbg3.body.logs.length).to.equal(dbg.body.logs.length)

    // re-enable capture and verify new entries get added
    const on = await request(app).post('/api/debug/discover/set').send({ enabled: true })
    expect(on.status).to.equal(200)
    expect(on.body.enabled).to.equal(true)
    const res3 = await request(app).get('/api/discover').query({ q: 'missing' })
    expect(res3.status).to.equal(200)
    const dbg4 = await request(app).get('/api/debug/discover')
    expect(dbg4.body.logs.length).to.be.greaterThan(dbg3.body.logs.length)

    // clear logs and confirm empty
    const clr = await request(app).post('/api/debug/discover/clear')
    expect(clr.status).to.equal(200)
    const dbg2 = await request(app).get('/api/debug/discover')
    expect(dbg2.body.logs).to.be.an('array').that.is.empty

    debugStub.restore()
    axiosStub.restore()
  })

  it('exposes and clears backoff debug state', async ()=>{
    // make two failing discover calls to seed backoff
    stub = sinon.stub(axios, 'get').callsFake((u)=>{
      if(u.includes('results?')) return Promise.reject(new Error('network'))
      return Promise.reject(new Error('unknown'))
    })
    const r1 = await request(app).get('/api/discover').query({ q: 'fail' })
    expect(r1.status).to.equal(500)
    const r2 = await request(app).get('/api/discover').query({ q: 'fail' })
    expect(r2.status).to.equal(500)

    // now fetch backoff debug state
    const dbg = await request(app).get('/api/debug/backoff')
    expect(dbg.status).to.equal(200)
    expect(dbg.body.backoff).to.be.an('object')
    // find our discover key
    const keys = Object.keys(dbg.body.backoff)
    const discoverKey = keys.find(k => k.startsWith('discover:'))
    expect(discoverKey).to.exist
    expect(dbg.body.backoff[discoverKey]).to.have.property('failures')

    // clear only that key
    const clr = await request(app).post('/api/debug/backoff/clear').send({ key: discoverKey })
    expect(clr.status).to.equal(200)
    expect(clr.body.cleared).to.equal(discoverKey)

    // verify cleared
    const dbg2 = await request(app).get('/api/debug/backoff')
    expect(dbg2.status).to.equal(200)
    expect(dbg2.body.backoff[discoverKey]).to.be.undefined

    // clear all (no key)
    const clrAll = await request(app).post('/api/debug/backoff/clear').send({})
    expect(clrAll.status).to.equal(200)
    expect(clrAll.body.cleared).to.equal('all')

    stub.restore()
  })

  it('honors backoff even when a cached discovery exists', async () => {
    // 1) seed a cached discover result by returning a discover feed
    stub = sinon.stub(axios, 'get').callsFake((u) => {
      if (u.includes('results?') && !u.includes('m.youtube.com')){
        const ytJson = JSON.stringify({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [ { itemSectionRenderer: { contents: [ { channelRenderer: { channelId: 'UCABC', title: { simpleText: 'Test Channel' } } } ] } } ] } } } } })
        return Promise.resolve({ data: `<html><body><script>var ytInitialData = ${ytJson};</script></body></html>` })
      }
      if (u.includes('feeds/videos.xml?channel_id=UCABC')){
        return Promise.resolve({ data: '<?xml version="1.0"?><feed><title>Channel feed</title><entry></entry></feed>' })
      }
      return Promise.reject(new Error('unknown '+u))
    })

    // first call should populate cache and return feed
    const ok = await request(app).get('/api/discover').query({ q: 'dogs' })
    expect(ok.status).to.equal(200)
    expect(ok.body.type).to.equal('feed')

    // 2) cause two failures to seed backoff for the same key — bypass cache with aggressive flag
    stub.restore()
    stub = sinon.stub(axios, 'get').rejects(new Error('network'))
    const f1 = await request(app).get('/api/discover').query({ q: 'dogs', aggressive: '1' })
    expect(f1.status).to.equal(500)
    const f2 = await request(app).get('/api/discover').query({ q: 'dogs', aggressive: '1' })
    expect(f2.status).to.equal(500)

    // 3) now backoff should take precedence over cache — expect 429 for non-aggressive call
    const bw = await request(app).get('/api/discover').query({ q: 'dogs' })
    expect(bw.status).to.equal(429)

    // 4) clear backoff and verify cached response is returned again
    const clr = await request(app).post('/api/debug/backoff/clear').send({ key: 'discover:dogs' })
    expect(clr.status).to.equal(200)
    const ok2 = await request(app).get('/api/discover').query({ q: 'dogs' })
    expect(ok2.status).to.equal(200)
    expect(ok2.body.type).to.equal('feed')

    stub.restore()
  })

  it('returns JSON 404 for unknown API paths and responds to health check', async ()=>{
    const h = await request(app).get('/api/health')
    expect(h.status).to.equal(200)
    expect(h.body).to.have.property('ok', true)

    const res = await request(app).get('/api/doesnotexist')
    expect(res.status).to.equal(404)
    expect(res.body).to.have.property('error')
  })

  it('accepts debug event posts and persists them to the debug buffer (dev-only)', async ()=>{
    const ev = await request(app).post('/api/debug/discover/event').send({ q: 'voidzilla', reason: 'test' })
    expect(ev.status).to.equal(200)
    expect(ev.body).to.have.property('ok', true)
    expect(ev.body.entry).to.have.property('q', 'voidzilla')

    const dbg = await request(app).get('/api/debug/discover')
    expect(dbg.status).to.equal(200)
    expect(dbg.body.logs.some(l => l.q === 'voidzilla')).to.equal(true)
  })
})