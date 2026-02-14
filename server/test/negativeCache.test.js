const { expect } = require('chai')
const { setNegative, isNegative, clearNegative, clearAllNegatives } = require('../../src/lib/negativeCache')

describe('negativeCache (client-side helper fallback)', ()=>{
  afterEach(()=>{ clearAllNegatives() })

  it('stores and expires negative entries', (done) => {
    setNegative('x-test', 50) // 50ms
    expect(isNegative('x-test')).to.equal(true)
    // after expiry should return false
    setTimeout(()=>{
      try{
        expect(isNegative('x-test')).to.equal(false)
        done()
      }catch(e){ done(e) }
    }, 120)
  })

  it('clearNegative removes an entry', ()=>{
    setNegative('y-test', 1000)
    expect(isNegative('y-test')).to.equal(true)
    clearNegative('y-test')
    expect(isNegative('y-test')).to.equal(false)
  })
})