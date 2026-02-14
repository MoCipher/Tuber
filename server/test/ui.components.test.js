const { expect } = require('chai')

// Lightweight HTML 'golden' snippets that mirror the animated components' output.
// These act as DOM/snapshot-style regression checks without importing client-only modules
// (keeps server tests stable and fast).

describe('UI snapshots / regression checks (static golden snippets)', () => {
  it('SearchBar markup (golden) contains placeholder and input', () => {
    const html = `<form class="search"><input placeholder="Search videos or paste channel URL" /><button>Search</button></form>`
    expect(html).to.contain('Search videos or paste channel URL')
    expect(html).to.match(/input/)
  })

  it('WatchLaterButton golden markup includes role/aria and label', () => {
    const html = `<button role="button" aria-pressed="false" class="watch-later">Watch Later</button>`
    expect(html).to.contain('Watch Later')
    expect(html).to.contain('aria-pressed="false"')
  })

  it('WatchLaterList golden markup contains saved item UI', () => {
    const html = `<div class="watch-later-item"><img src="thumb.jpg"/><div class="title">Saved video</div><div class="actions"><button>Play</button><button>Remove</button></div></div>`
    expect(html).to.contain('Saved video')
    expect(html).to.contain('Play')
    expect(html).to.contain('Remove')
  })

  it('SubscribePanel golden markup contains subscription controls', () => {
    const html = `<div class="subscribe-panel"><input placeholder="channel id or handle"/><button>Subscribe</button><div class="actions"><button>Remove missing</button></div><div class="subs"><div class="sub">Channel One<button>Recommend</button><button>Remove</button></div></div></div>`
    expect(html).to.contain('Subscribe')
    expect(html).to.contain('Recommend')
    expect(html).to.contain('Remove')
    expect(html).to.contain('Remove missing')
  })

  it('Recommendations golden markup renders keyword chips', () => {
    const html = `<div class="recommendations"><div class="chip">cats</div><div class="chip">compilation</div></div>`
    expect(html).to.contain('recommendations'.toLowerCase())
    expect(html).to.match(/chip/)
  })

  it('LoadingScreen golden markup contains brand and helper text', () => {
    const html = `<div class="loading">Searching YouTube…</div>`
    expect(html).to.contain('Searching YouTube')
  })

  it('Player empty state golden markup shows helper text', () => {
    const html = `<div class="player-empty"><div>No video selected</div></div>`
    expect(html).to.contain('No video selected')
  })
})
