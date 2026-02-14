const { expect } = require('chai')
const { generateDigest } = require('../../src/lib/recommend')

describe('digest generator', ()=>{
  it('prefers recommendations and respects limit', ()=>{
    const recs = [ {id:'a', title:'A', published:'2026-02-10', thumbnail:'', channelTitle:'C1', score:3}, {id:'b', title:'B', published:'2026-02-08', thumbnail:'', channelTitle:'C2', score:2} ]
    const videos = [ {id:'x', title:'X', published:'2026-02-09', thumbnail:'', channelTitle:'C1'}, {id:'y', title:'Y', published:'2026-02-07', thumbnail:'', channelTitle:'C3'} ]
    const subs = [ {value:'c1', title:'C1', recommend:true, boost:1.5}, {value:'c2', title:'C2', recommend:false, boost:1} ]
    const out = generateDigest(recs, videos, subs, new Set(), 3)
    expect(out.map(x=>x.id)).to.include('a')
    expect(out.length).to.equal(3)
  })

  it('omits notInterested and disabled channels', ()=>{
    const recs = [ {id:'a', title:'A', published:'2026-02-10', thumbnail:'', channelTitle:'C1', score:3}, {id:'b', title:'B', published:'2026-02-08', thumbnail:'', channelTitle:'C2', score:2} ]
    const videos = [ {id:'c', title:'C', published:'2026-02-09', thumbnail:'', channelTitle:'C2'} ]
    const subs = [ {value:'c2', title:'C2', recommend:false, boost:1} ]
    const out = generateDigest(recs, videos, subs, new Set(['a']), 5)
    expect(out.map(x=>x.id)).to.not.include('a')
    expect(out.map(x=>x.id)).to.not.include('c')
  })
})