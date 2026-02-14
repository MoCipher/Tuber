import React, {useState, useEffect} from 'react'
import { motion, AnimatePresence } from './lib/motion'

export default function SearchModal({onClose, query, onAddSub, onPlay, results=[], onSearch, searchSource, reduceMotion, discoveryLoading, discoveryFailed, discoveryAttempts, discoveryBackoffRemainingMs=0, discoveryErrorMsg=null, onRetryDiscovery, onCancelDiscovery, onOpenDebug, lastQuery, lastDiscoveryAgo, searchAggressive=false, searchProgress=null}){
  const [localQ, setLocalQ] = useState(query||'')
  const [subscribed, setSubscribed] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [quickCount, setQuickCount] = useState(null)
  const [banner, setBanner] = useState(null)
  // use health props from parent when available (fallback to local state for backwards compat)
  const [healthLoadingLocal, setHealthLoadingLocal] = useState(false)
  const [healthStatusLocal, setHealthStatusLocal] = useState(null)
  const [healthMessageLocal, setHealthMessageLocal] = useState(null)

  // helper: perform quick search then full search and apply progressive updates
  const quickControllerRef = React.useRef(null)

  async function handleSearch(q){
    setMoreLoading(false)
    setBanner(null)
    if(!q) return
    try{
      // abort last quick
      try{ if(quickControllerRef.current){ quickControllerRef.current.abort(); quickControllerRef.current = null } }catch(e){}
      quickControllerRef.current = new AbortController()
      const qctrl = quickControllerRef.current
      // quick search: try server quick mode (search RSS only)
      const quick = await fetch(`/api/search?quick=1&q=${encodeURIComponent(q)}`, { signal: qctrl.signal })
      if(quick.ok){
        const j = await quick.json()
        const feed = j.feed || j
        const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry? [feed.entry] : [])
        if(entries.length>0){
          const items = entries.map(e=>({ id: e['yt:videoId'] || e['id']?.split(':').pop(), title: e.title, published: e.published, thumbnail: e['media:group']?.['media:thumbnail']?.['@_url'] || '', channelTitle: feed.title }))
          if(items.length>0){
            setQuickCount(items.length)
            // pass quick results to main search so UI can show them and avoid noisy fallbacks
            if(typeof onSearch === 'function') onSearch(q, { quickResults: items })
          }
        }
      }
    }catch(e){ /* ignore (likely abort) */ }
    // indicate more comprehensive search is running
    setMoreLoading(true)
    try{
      if(typeof onSearch==='function') await onSearch(q)
    }finally{ setMoreLoading(false) }
  }

  useEffect(()=>{
    // show a transient update banner if inbound results count increases
    let prev = null
    const id = setTimeout(()=>{},0)
    return ()=> clearTimeout(id)
  }, [])

  // If the parent provides health props, use them; otherwise fallback to local check
  async function checkServerLocal(){
    try{
      setHealthLoadingLocal(true)
      setHealthStatusLocal(null)
      setHealthMessageLocal(null)
      const res = await fetch('/api/health')
      if(!res.ok){
        const txt = await res.text().catch(()=>null)
        // if server returned HTML 404 page, show actionable hint
        const ct = res.headers && res.headers.get ? res.headers.get('content-type') : null
        if(ct && ct.includes('text/html')){
          setHealthStatusLocal('error')
          setHealthMessageLocal('Server returned HTML 404 — the API server may not be running. Try running `npm run server`.')
        }else{
          setHealthStatusLocal('error')
          setHealthMessageLocal(txt || `Status ${res.status}`)
        }
      }else{
        const j = await res.json()
        if(j && j.ok){ setHealthStatusLocal('ok'); setHealthMessageLocal(null) }
        else { setHealthStatusLocal('error'); setHealthMessageLocal('Health check failed') }
      }
    }catch(e){ setHealthStatusLocal('error'); setHealthMessageLocal(e && e.message ? String(e.message) : 'Network error') }
    setHealthLoadingLocal(false)
  }

  useEffect(()=>{
    // show a delta-only "More results" banner when we get more than the previous quick results
    // keep a ref to the previous interesting count (often the quick results count)
    const prev = (typeof window.__prevResultsCount__ !== 'undefined') ? window.__prevResultsCount__ : null
    const current = results.length

    // If we previously had a small quick result set and now have more, show a delta banner
    if(prev !== null && current > prev){
      const delta = current - prev
      setBanner({ type: 'more', delta })
      // auto-hide after a few seconds
      setTimeout(()=> setBanner(null), 3500)
    }

    // track quickCount as a suggested previous baseline when available
    if(quickCount && (typeof window.__prevResultsCount__ === 'undefined' || window.__prevResultsCount__ <= quickCount)){
      window.__prevResultsCount__ = quickCount
    } else {
      window.__prevResultsCount__ = current
    }
  }, [results, quickCount])

  return (
    <div className="modal-overlay">
      <div className="modal">
        {discoveryLoading && (
          <div className="discovery-overlay" role="status" aria-live="polite">
            <div className="discovery-card">
              <div className="spinner" aria-hidden></div>
              <div style={{marginTop:12}}>Searching YouTube for possible channels or videos…</div>
            </div>
          </div>
        )}
        {(!discoveryLoading && discoveryFailed) && (
          <div className="discovery-overlay" role="status" aria-live="polite">
            <div className="discovery-card">
              <div style={{fontSize:14,fontWeight:700}}>Discovery lookup failed</div>
              <div style={{marginTop:8,color:'#6b7280'}}>We couldn't find results automatically. You can retry (we'll try again) or subscribe manually.</div>
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button className="small primary" onClick={()=>{ if(typeof onRetryDiscovery==='function') onRetryDiscovery() }} disabled={discoveryBackoffRemainingMs>0}>{discoveryBackoffRemainingMs>0 ? `Retrying in ${Math.ceil(discoveryBackoffRemainingMs/1000)}s` : 'Retry'}</button>
                <button className="small" onClick={()=>{ if(typeof onCancelDiscovery==='function') onCancelDiscovery() }}>Cancel</button>
                <button className="small" onClick={()=>{ if(localQ) onAddSub(localQ) }}>Subscribe manually</button>                <button className="small" onClick={async ()=>{ setDiscoveryLoading(true); try{ const q = lastQuery || localQ; if(typeof onSearch === 'function') await onSearch(q, {aggressive:true}); }catch(e){} finally{ setDiscoveryLoading(false) } }}>Try deeper search</button>              </div>
              <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>Attempts: {discoveryAttempts || 0}</div>
              { lastDiscoveryAgo && (
                <div style={{marginTop:6,fontSize:12,color:'#9ca3af'}}>Last discovery: {lastDiscoveryAgo}</div>
              )}
              { discoveryErrorMsg && (
                <div style={{marginTop:6,fontSize:12,color:'#b45309',display:'flex',alignItems:'center',gap:8}}>
                  <div>{discoveryErrorMsg}</div>
                  <div style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                    <button className="small" onClick={async ()=>{ if(typeof onCheckServer === 'function'){ await onCheckServer() } else { await checkServerLocal() } }} disabled={(typeof onCheckServer === 'function' ? healthLoading : healthLoadingLocal)}>{(typeof onCheckServer === 'function' ? (healthLoading ? 'Checking…' : 'Check server') : (healthLoadingLocal ? 'Checking…' : 'Check server'))}</button>
                    {((typeof onCheckServer === 'function' ? healthStatus : healthStatusLocal) === 'ok') && <div style={{fontSize:12,color:'#16a34a'}}>Server OK</div>}
                    {((typeof onCheckServer === 'function' ? healthStatus : healthStatusLocal) === 'error') && <div style={{fontSize:12,color:'#b45309'}}>{(typeof onCheckServer === 'function' ? healthMessage : healthMessageLocal) || 'Unavailable'}</div>}
                    {import.meta.env.DEV && typeof onOpenDebug === 'function' && (
                      <button className="small" onClick={()=>onOpenDebug()}>Open Debug</button>
                    )}
                  </div>
                </div>
              )}
              { discoveryBackoffRemainingMs > 0 && (
                <div style={{marginTop:6,fontSize:12,color:'#b45309'}}>Discovery temporarily limited — retry available in {Math.ceil(discoveryBackoffRemainingMs/1000)}s</div>
              )}
            </div>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input value={localQ} onChange={e=>setLocalQ(e.target.value)} placeholder="Search (channel name, URL or ID)" aria-label="Search or paste channel URL/ID" style={{padding:10,borderRadius:10,border:'1px solid rgba(0,0,0,0.06)',minWidth:0}} />
            <button className="small primary" onClick={()=>{ if(typeof onSearch === 'function') onSearch(localQ); }}>Search</button>
          </div>
          <button className="cta ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>Tip: If no RSS search results are returned we will try a discovery lookup on YouTube to find a channel or video (may take an extra moment). You will see quick results first and more comprehensive results updated if available. If you still don't see a match, try a deeper search that will attempt more fallbacks and a full discovery scan (may take longer).</div>
        <div style={{marginTop:12,maxHeight:420,overflow:'auto'}}>
          {searchSource && (
            <motion.div className="search-banner" role="status" aria-live="polite" initial={reduceMotion?{}:{opacity:0,y:-6}} animate={reduceMotion?{}:{opacity:1,y:0}} transition={{duration:0.28}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {searchSource.type === 'feed' && searchSource.thumbnail && <img src={searchSource.thumbnail} alt={`${searchSource.title} thumbnail`} style={{width:64,height:64,objectFit:'cover',borderRadius:8}} />}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'#111',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <div>
                      {searchSource.type === 'feed' && (
                        <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                          <strong style={{fontWeight:700}}>{searchSource.title}</strong>
                          <motion.span
                            aria-hidden
                            initial={reduceMotion?{}:{scale:0,opacity:0}}
                            animate={subscribed ? (reduceMotion?{scale:1,opacity:1}:{scale:[0,1.15,1],opacity:1}) : (reduceMotion?{opacity:0}:{opacity:[0,1,0]})}
                            transition={{duration:0.36}}
                            style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}
                          >
                            {subscribed ? (
                              <svg className="checkmark" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                                <path d="M20 6L9 17l-5-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </motion.span>
                        </span>
                      )}
                      {searchSource.type === 'search' && <span>Search results for "<em>{searchSource.query}</em>"</span>}
                      {searchSource.type === 'empty' && <span>No results found</span>}
                      {searchSource.type === 'error' && <span>Search error</span>}
                    </div>

                    {/* Source indicator */}
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:12,color:'#6b7280'}} aria-hidden>
                      {searchSource.type === 'search' && (
                        <span title="Search RSS" aria-hidden style={{display:'inline-flex',alignItems:'center',gap:6}}>
                          <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M21 21l-4.35-4.35" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" stroke="#6b7280" strokeWidth="2" fill="none" /></svg>
                          <span style={{fontSize:12}}>Search</span>
                          {searchSource.confidence && <span title={`Confidence: ${Math.round(searchSource.confidence*100)}% — estimated reliability`} style={{fontSize:11,color:'#9ca3af'}}>{` · ${(searchSource.confidence*100).toFixed(0)}%`}</span>}
                        </span>
                      )}
                      {searchSource.type === 'feed' && (
                        <span title="Feed" aria-hidden style={{display:'inline-flex',alignItems:'center',gap:6}}>
                          <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M4 11a9 9 0 0 1 9 9" stroke="#6b7280" strokeWidth="2" fill="none"/><path d="M4 6a14 14 0 0 1 14 14" stroke="#6b7280" strokeWidth="2" fill="none"/><circle cx="6" cy="18" r="1" fill="#6b7280"/></svg>
                          <span style={{fontSize:12}}>Feed</span>
                          {searchSource.confidence && <span title={`Confidence: ${Math.round(searchSource.confidence*100)}% — estimated reliability`} style={{fontSize:11,color:'#9ca3af'}}>{` · ${(searchSource.confidence*100).toFixed(0)}%`}</span>}
                        </span>
                      )}
                      {searchSource.type === 'video' && (
                        <span title="Video found" aria-hidden style={{display:'inline-flex',alignItems:'center',gap:6}}>
                          <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M5 3v18l15-9L5 3z" fill="#6b7280"/></svg>
                          <span style={{fontSize:12}}>Video</span>
                          {searchSource.confidence && <span title={`Confidence: ${Math.round(searchSource.confidence*100)}% — estimated reliability`} style={{fontSize:11,color:'#9ca3af'}}>{` · ${(searchSource.confidence*100).toFixed(0)}%`}</span>}
                        </span>
                      )}
                      {/* When we fall back to discovery, we show that too */}
                      {searchSource.type === 'feed' && searchSource.source === 'discovery' && (
                        <span title="Discovery" aria-hidden style={{display:'inline-flex',alignItems:'center',gap:6}}>
                          <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" stroke="#6b7280" strokeWidth="1" fill="none"/></svg>
                          <span style={{fontSize:12}}>Discovery</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {searchSource.type === 'feed' && searchSource.description && <div style={{fontSize:12,color:'#6b7280',marginTop:6}}>{searchSource.description}</div>}
                </div>
                {searchSource.type === 'feed' && <div>
                  <button className="small primary" disabled={subscribed} aria-pressed={subscribed} aria-label={`Subscribe to ${searchSource.title}`} onClick={async ()=>{
                      try{
                        await onAddSub(searchSource.title)
                        setSubscribed(true)
                        setTimeout(()=>setSubscribed(false), 1600)
                      }catch(e){ console.error('subscribe banner', e) }
                    }}>
                    {subscribed ? 'Subscribed ✓' : 'Subscribe'}
                  </button>
                </div>}
              </div>
              { quickCount && moreLoading && (
                <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>Showing {quickCount} quick results — more comprehensive results may arrive shortly…</div>
              )}

              {/* Deeper-search progress (aggressive search) */}
              { searchAggressive && searchProgress && (
                <div style={{marginTop:10,padding:8,borderRadius:8,background:'#f8fafc',fontSize:13}}>
                  <div style={{fontWeight:700,marginBottom:6}}>Deeper search progress</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {['quick','feedFallbacks','discoveryDesktop','discoveryMobile','done'].map(step=>{
                      const status = searchProgress[step] || 'pending'
                      return (
                        <div key={step} style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:10,height:10,borderRadius:10,background: status==='done' ? '#16a34a' : (status==='running' ? '#f59e0b' : '#d1d5db')}} aria-hidden />
                          <div style={{color:'#374151'}}>{step === 'feedFallbacks' ? 'Feed fallbacks' : (step === 'discoveryDesktop' ? 'Discovery (desktop)' : (step === 'discoveryMobile' ? 'Discovery (mobile)' : (step === 'quick' ? 'Quick RSS' : 'Done')))}</div>
                          <div style={{marginLeft:'auto',fontSize:12,color:'#6b7280'}}>{status}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              { banner && banner.type === 'more' && (
                <div style={{marginTop:8,fontSize:12,color:'#111',fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
                  <div>{banner.delta} more result{banner.delta>1 ? 's' : ''} available</div>
                  <button className="small" onClick={()=>{ /* acknowledge and clear */ window.__prevResultsCount__ = results.length; setBanner(null); }}>Show</button>
                </div>
              )}
            </motion.div>
          )}

          {results.length===0 && (
            <div className="empty">
              {discoveryLoading || moreLoading ? (
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div className="spinner" aria-hidden></div>
                  <div>Searching YouTube for possible channels or videos… Showing quick results first, updating as more results arrive.</div>
                </div>
              ) : (
                <>
                No results yet. Tip: paste a channel URL or channel ID (e.g., starts with "UC") or try a different keyword.
                <div style={{marginTop:8}}>
                  <button className="small" onClick={()=>{ handleSearch(localQ); }}>Search again</button>
                  <button className="small" style={{marginLeft:8}} onClick={()=>{ if(localQ) onAddSub(localQ) }}>Subscribe</button>                  <button className="small" style={{marginLeft:8}} onClick={async ()=>{ setMoreLoading(true); try{ if(typeof onSearch==='function') await onSearch(localQ, {aggressive: true}); }catch(e){} finally{ setMoreLoading(false) } }}>Try deeper search</button>                </div>
                </>
              )}
            </div>
          )}
          <AnimatePresence initial={false}>
            {results.map(r=> (
              <motion.div key={r.id} layout initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} transition={{type:'spring', stiffness:400, damping:28}} style={{display:'flex',gap:12,alignItems:'center',padding:8,borderRadius:8}}>
                <img src={r.thumbnail} style={{width:120,height:68,objectFit:'cover',borderRadius:8}} />
                <div style={{flex:1}}>
                  <div style={{fontWeight:700}}>{r.title}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>{r.channelTitle}</div>
                  {r.confidence && <div title={`Confidence: ${Math.round(r.confidence*100)}% — estimated reliability`} style={{fontSize:11,color:'#9ca3af',marginTop:6}}>{`${Math.round(r.confidence*100)}%`}</div>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button className="small" onClick={()=>onPlay(r)}>Play</button>
                  <button className="small" onClick={()=>onAddSub(r.channelTitle)}>Subscribe</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}