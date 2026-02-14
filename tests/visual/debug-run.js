const { chromium } = require('playwright');
(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => console.log('[browser console]', m.type(), m.text()));
  page.on('requestfailed', r => console.log('[request failed]', r.url(), r.failure() && r.failure().errorText))
  page.on('requestfinished', async r => { try{ const res = await r.response(); console.log('[request finished]', r.url(), res && res.status()); }catch(e){ console.log('[request finished]', r.url(), 'no response') } })
  try{
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    const content = await page.content();
    console.log('BODY HTML SNIPPET:\n', content.slice(0, 2000));
    const htmlChildrenCount = await page.evaluate(()=> document.getElementById('root')?.children.length || 0)
    console.log('root children count:', htmlChildrenCount)
    const hasReactRoot = await page.evaluate(()=> !!(document.getElementById('root') && Object.keys(document.getElementById('root')).some(k=>k.includes('__reactContainer')||k.includes('__reactInternalInstance'))))
    console.log('has react root marker (heuristic):', hasReactRoot)
    const rootInner = await page.evaluate(()=> document.getElementById('root')?.innerHTML || '')
    console.log('root inner snippet:', rootInner.slice(0,200))
  }catch(e){ console.error('error loading page', e) }
  await browser.close();
})();
