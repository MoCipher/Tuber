const request = require('supertest')
const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const app = require('../index.ts').default || require('../index.ts')

describe('GET /api/channel/avatar', ()=>{
  let stub
  afterEach(()=>{ if(stub) stub.restore() })

  it('returns avatar from channel page og:image', async ()=>{
    stub = sinon.stub(axios, 'get').callsFake((u)=>{
      if(u.includes('channel/')){
        return Promise.resolve({ data: '<html><head><meta property="og:image" content="https://example.com/avatar.jpg"/></head><body></body></html>' })
      }
      return Promise.reject(new Error('unknown'))
    })
    const res = await request(app).get('/api/channel/avatar').query({ channel_id: 'UCABC' })
    expect(res.status).to.equal(200)
    expect(res.body).to.have.property('thumbnail')
    expect(res.body.thumbnail).to.equal('https://example.com/avatar.jpg')
  })

  it('returns null thumbnail on fetch errors', async ()=>{
    stub = sinon.stub(axios, 'get').rejects(new Error('fail'))
    const res = await request(app).get('/api/channel/avatar').query({ channel_id: 'UCNO' })
    expect(res.status).to.equal(200)
    expect(res.body.thumbnail).to.equal(null)
  })
})