const request = require('supertest')
const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const app = require('../index.ts').default || require('../index.ts')

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <title>Test Channel</title>
  <entry>
    <id>yt:video:AAA</id>
    <yt:videoId>AAA</yt:videoId>
    <title>Video One</title>
    <published>2026-02-10T00:00:00+00:00</published>
    <link rel="alternate" href="https://www.youtube.com/watch?v=AAA"/>
    <media:group>
      <media:thumbnail url="https://example.com/thumb1.jpg"/>
    </media:group>
  </entry>
</feed>`

describe('GET /api/feed', ()=>{
  let stub
  afterEach(()=>{ if(stub) stub.restore() })

  it('returns feed for channel_id', async ()=>{
    stub = sinon.stub(axios, 'get').resolves({ data: sampleXml })
    const res = await request(app).get('/api/feed').query({ channel_id: 'test' })
    expect(res.status).to.equal(200)
    expect(res.body.feed).to.exist
    expect(res.body.feed.title).to.equal('Test Channel')
  })

  it('returns 404 when no feed found', async ()=>{
    stub = sinon.stub(axios, 'get').rejects(new Error('not found'))
    const res = await request(app).get('/api/feed').query({ channel_id: 'missing' })
    expect(res.status).to.equal(404)
    expect(res.body.error).to.match(/No feed found/)
  })

  it('accepts full YouTube channel URL in channel_id and normalizes it', async ()=>{
    stub = sinon.stub(axios, 'get').resolves({ data: sampleXml })
    const res = await request(app).get('/api/feed').query({ channel_id: 'https://www.youtube.com/channel/UCABC' })
    expect(res.status).to.equal(200)
    expect(res.body.feed).to.exist
    expect(res.body.feed.title).to.equal('Test Channel')
  })

  it('accepts full channel/user URL in user and normalizes it', async ()=>{
    stub = sinon.stub(axios, 'get').resolves({ data: sampleXml })
    const res = await request(app).get('/api/feed').query({ user: 'https://www.youtube.com/c/misaha' })
    expect(res.status).to.equal(200)
    expect(res.body.feed).to.exist
    expect(res.body.feed.title).to.equal('Test Channel')
  })
})