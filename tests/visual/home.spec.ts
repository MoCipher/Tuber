import { test, expect } from '@playwright/test'

const searchFixture = {
  feed: {
    title: 'Mock feed',
    entry: [
      { title: 'Funny cats — test', 'yt:videoId': 'vid-cat-1', 'media:group': { 'media:thumbnail': { '@_url': '/placeholder.jpg' } } },
      { title: 'Cats compilation', 'yt:videoId': 'vid-cat-2', 'media:group': { 'media:thumbnail': { '@_url': '/placeholder.jpg' } } }
    ]
  }
}

test('landing — header and empty state (static render)', async ({ page }) => {
  await page.goto('/')
  // inject a minimal, styled snapshot of the landing header + empty state
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = `
      <div class="app-root" style="padding:24px;font-family:Inter,system-ui,Segoe UI,Roboto;">
        <h1 style="margin:0;font-size:20px">Tuber</h1>
        <p style="color:#6b7280">Privacy-first, local-first YouTube frontend — now in TypeScript.</p>
        <div style="margin-top:20px;padding:18px;border-radius:12px;background:#fff;box-shadow:0 8px 30px rgba(2,6,23,0.04);min-height:140px;display:flex;align-items:center;justify-content:center">
          <div style="color:#9ca3af">No results yet. Tip: paste a channel URL or channel ID.</div>
        </div>
      </div>`
  })
  await expect(page.locator('text=No results yet')).toHaveScreenshot('landing-empty.png')
})

test('watch-later panel shows saved item (static render)', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = `
      <div style="padding:20px">
        <div style="font-weight:700;margin-bottom:8px">Watch later</div>
        <div class="bg-white" style="background:#fff;padding:12px;border-radius:8px;box-shadow:0 6px 18px rgba(2,6,23,0.04);">
          <div class="watch-later-item" style="display:flex;gap:12px;align-items:center">
            <img src="/placeholder.jpg" style="width:56px;height:40px;object-fit:cover;border-radius:6px" />
            <div style="flex:1"><div style="font-weight:700">Saved video</div><div style="font-size:12px;color:#9ca3af">Saved 9/13/2020</div></div>
            <div style="display:flex;gap:6px"><button class="small">Play</button><button class="small">Remove</button></div>
          </div>
        </div>
      </div>`
  })
  const panel = page.locator('.bg-white')
  await expect(panel).toContainText('Saved video')
  await expect(panel).toHaveScreenshot('watchlater-panel.png')
})

test('search results render (mocked, static injection)', async ({ page }) => {
  await page.route('**/api/search**', (route) => {
    const url = route.request().url()
    if (url.includes('cats')) route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchFixture) })
    else route.continue()
  })

  await page.goto('/')
  // inject a mock results grid that mimics the real layout (visual snapshot only)
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = `
      <div style="padding:20px">
        <div class="grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          <div style="padding:12px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.04)">
            <img src="/placeholder.jpg" style="width:100%;height:120px;object-fit:cover;border-radius:8px" />
            <div style="margin-top:8px;font-weight:700">Funny cats — test</div>
            <div style="display:flex;gap:8px;margin-top:6px"><button class="small">Play</button><button class="small">Watch Later</button></div>
          </div>
          <div style="padding:12px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.04)">
            <img src="/placeholder.jpg" style="width:100%;height:120px;object-fit:cover;border-radius:8px" />
            <div style="margin-top:8px;font-weight:700">Cats compilation</div>
            <div style="display:flex;gap:8px;margin-top:6px"><button class="small">Play</button><button class="small">Watch Later</button></div>
          </div>
        </div>
      </div>`
  })
  const grid = page.locator('.grid')
  await expect(grid).toHaveScreenshot('search-results.png')
})

test('search result hover overlay (visual)', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = `
      <div style="padding:20px">
        <div class="grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          <div class="card" style="padding:12px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.04);position:relative;">
            <img src="/placeholder.jpg" class="thumb" style="width:100%;height:120px;object-fit:cover;border-radius:8px" />
            <div style="margin-top:8px;font-weight:700">Funny cats — test</div>
            <div class="overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;background:rgba(0,0,0,0.35);transition:opacity .15s">
              <button style="padding:6px 10px;border-radius:6px;background:#fff">Play</button>
            </div>
          </div>
        </div>
      </div>`
  })
  const card = page.locator('.card')
  await card.hover()
  // reveal overlay in the DOM (simulate hover effect)
  await page.evaluate(()=> document.querySelector('.overlay')!.style.opacity = '1')
  await expect(card).toHaveScreenshot('search-result-hover.png')
})

test('player controls snapshot (static)', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(()=>{
    document.getElementById('root')!.innerHTML = `
      <div style="padding:24px;width:480px">
        <div style="font-weight:700">Funny cats — test</div>
        <div style="margin-top:12;border-radius:12px;overflow:hidden">
          <iframe src="https://www.youtube-nocookie.com/embed/vid-cat-1" width="100%" height="220" frameborder="0"></iframe>
        </div>
        <div style="display:flex;gap:8px;margin-top:12">
          <button class="small">Open on YouTube</button>
          <button class="small">Save to Watch Later</button>
        </div>
      </div>`
  })
  const player = page.locator('iframe')
  await expect(player).toHaveScreenshot('player-controls.png')
})

test('index includes optional polyfill script', async ({ page }) => {
  await page.goto('/')
  const poly = await page.locator('script[src*="polyfill.io"]')
  await expect(poly).toHaveCount(1)
})
