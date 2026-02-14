const request = require('supertest')
const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const app = require('../index.ts').default || require('../index.ts')

const sampleQuickXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Quick Search</title>
  <entry>
    <id>yt:video:QQQ</id>
    <yt:videoId>QQQ</yt:videoId>
    <title>Quick One</title>
    <published>2026-02-10T00:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://example.com/qthumb.jpg"/>
    </media:group>
  </entry>
</feed>`

describe('Progressive search pipeline (quick -> discovery)', () => {
  let stub
  afterEach(()=>{ if(stub) stub.restore() })

  it('returns quick results first and discovery finds a higher-confidence feed', async ()=>{
    stub = sinon.stub(axios, 'get').callsFake((u)=>{
      // quick search (RSS) hits feeds/videos.xml?search_query=
      if(u.includes('feeds/videos.xml') && u.includes('search_query=')){
        return Promise.resolve({ data: sampleQuickXml })
      }
      // desktop search results page: return minimal/no data
      if(u.includes('results?') && !u.includes('m.youtube.com')){
        return Promise.resolve({ data: '<html><body><div>No useful data</div></body></html>' })
      }
      // mobile search results: include a channel link
      if(u.includes('m.youtube.com/results')){
        return Promise.resolve({ data: '<html><body><a href="/channel/UCDEMO">Demo Channel</a></body></html>' })
      }
      // channel feed
      if(u.includes('feeds/videos.xml?channel_id=UCDEMO')){
        return Promise.resolve({ data: '<?xml version="1.0"?><feed><title>Demo Channel</title><entry><id>yt:video:D1</id><yt:videoId>D1</yt:videoId><title>D1</title></entry><entry><id>yt:video:D2</id><yt:videoId>D2</yt:videoId><title>D2</title></entry><entry><id>yt:video:D3</id><yt:videoId>D3</yt:videoId><title>D3</title></entry></feed>' })
      }
      return Promise.reject(new Error('unknown '+u))
    })

    // quick results
    const qres = await request(app).get('/api/search').query({ quick: 1, q: 'demo' })
    expect(qres.status).to.equal(200)
    expect(qres.body.feed).to.exist
    const entries = Array.isArray(qres.body.feed.entry) ? qres.body.feed.entry : (qres.body.feed.entry ? [qres.body.feed.entry] : [])
    expect(entries.length).to.equal(1)

    // now discovery should find the channel and provide a feed id + confidence
    const d = await request(app).get('/api/discover').query({ q: 'demo' })
    expect(d.status).to.equal(200)
    expect(d.body.type).to.equal('feed')
    expect(d.body.id).to.equal('UCDEMO')
    expect(d.body.confidence).to.be.a('number')
    expect(d.body.confidence).to.be.at.least(0.5)
  })
})