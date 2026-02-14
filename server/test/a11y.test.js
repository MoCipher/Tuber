const { expect } = require('chai')
const axe = require('axe-core')
const { JSDOM } = require('jsdom')

describe('Accessibility: Search modal (basic)', () => {
  it('has no axe violations for the search modal markup', async () => {
    const html = `
      <div class="modal">
        <div role="dialog" aria-modal="true">
          <input id="search" aria-label="Search" />
          <div class="search-banner" role="status" aria-live="polite">Showing results from <strong>Example</strong></div>
          <button class="small primary">Subscribe</button>
        </div>
      </div>`

    const dom = new JSDOM(html)
    const { window } = dom

    // expose globals required by axe
    global.window = window
    global.document = window.document
    global.Node = window.Node
    global.Element = window.Element
    global.HTMLElement = window.HTMLElement
    global.navigator = window.navigator

    // inject axe into this jsdom window
    const virtualConsole = new (require('jsdom')).VirtualConsole()
    virtualConsole.sendTo(console)

    // Basic polyfills & inject axe into jsdom window
    // Provide a minimal canvas getContext to avoid not-implemented errors in jsdom
    if(window && window.HTMLCanvasElement && !window.HTMLCanvasElement.prototype.getContext){
      window.HTMLCanvasElement.prototype.getContext = function(){ return {} }
    }

    const axeSource = axe.source || ''
    if(!axeSource) throw new Error('axe source not available')
    window.eval(axeSource)

    // Limit rules to structural/ARIA checks (avoids color/contrast rules that require full rendering)
    const axeOptions = { runOnly: { type: 'rule', values: ['aria-allowed-attr','aria-required-attr','aria-roles','button-name','label'] } }

    const results = await new Promise((resolve, reject) => {
      window.axe.run(window.document, axeOptions, (err, res) => {
        if(err) return reject(err)
        resolve(res)
      })
    })

    expect(results.violations).to.be.an('array')
    expect(results.violations.length).to.equal(0)
  }).timeout(5000)
})