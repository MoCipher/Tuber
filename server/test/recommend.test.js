const { expect } = require('chai')
const { extractKeywords, aggregateSearchResults } = require('../../src/lib/recommend')

describe('recommend helpers', ()=>{
  it('extracts keywords in order', ()=>{
    const titles = ['Hello world video','World of code','Hello again']
    const keys = extractKeywords(titles, 5)
    expect(keys[0]).to.equal('hello')
    expect(keys).to.include('world')
  })

  it('aggregates search results and filters existing', ()=>{
    const resultsByKeyword = {
      js: [{id:'a',title:'A',published:'2026-01-01',thumbnail:'',channelTitle:'C1'},{id:'b',title:'B',published:'2026-01-02',thumbnail:'',channelTitle:'C2'}],
      react: [{id:'b',title:'B',published:'2026-01-02',thumbnail:'',channelTitle:'C2'},{id:'c',title:'C',published:'2026-01-03',thumbnail:'',channelTitle:'C3'}]
    }
    const existing = new Set(['c'])
    const notInterested = new Set(['a'])
    const out = aggregateSearchResults(resultsByKeyword, existing, notInterested)
    expect(out.map(x=>x.id)).to.not.include('a')
    expect(out.map(x=>x.id)).to.include('b')
  })
})