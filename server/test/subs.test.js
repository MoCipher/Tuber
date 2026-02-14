const { expect } = require('chai')
const { mergeSubscriptions, arrayToSeenSet, seenSetToArray, markAllSeenIds } = require('../../src/lib/subs')

describe('subscriptions helpers', ()=>{
  it('merges subs without duplicates', ()=>{
    const a = [{value:'a',title:'A'},{value:'b',title:'B'}]
    const b = [{value:'b',title:'B2'},{value:'c',title:'C'}]
    const merged = mergeSubscriptions(a,b)
    expect(merged.map(x=>x.value)).to.have.members(['a','b','c'])
  })

  it('seen set conversions', ()=>{
    const s = arrayToSeenSet(['x','y'])
    expect(seenSetToArray(s)).to.have.members(['x','y'])
  })

  it('markAllSeenIds', ()=>{
    const prev = new Set(['a'])
    const all = markAllSeenIds(['x','b'], prev)
    expect(Array.from(all)).to.include.members(['a','x','b'])
  })
})