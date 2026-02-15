import React from 'react'
import { motion } from '../lib/motion'

// load YouTube IFrame API once per app
function loadYouTubeApi(){
  if(typeof window === 'undefined') return Promise.resolve()
  if((window as any).YT && (window as any).YT.Player) return Promise.resolve()
  return new Promise<void>((resolve, reject)=>{
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]')
    if(existing){
      const check = () => { if((window as any).YT && (window as any).YT.Player) resolve(); else setTimeout(check, 100) }
      return check()
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onload = () => {
      const check = () => { if((window as any).YT && (window as any).YT.Player) resolve(); else setTimeout(check, 100) }
      check()
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function Player({ video, onSave }:{ video?: any; onSave?: (v:any)=>void }){
  // Hooks must always be called unconditionally and in the same order.
  const [forceUnsafe, setForceUnsafe] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<null | { code: number, msg: string }>(null)
  const playerRef = React.useRef<HTMLDivElement | null>(null)
  const ytPlayerRef = React.useRef<any>(null)

  // compute privacy flags safely (do not call hooks here)
  const strictGlobal = (()=>{ try{ return typeof localStorage !== 'undefined' && localStorage.getItem('privacy:strict') === '1' }catch(e){ return false } })()
  const strictPerVideo = (()=>{ try{ return !!video && typeof localStorage !== 'undefined' && localStorage.getItem(`privacy:override:${video.id}`) === '1' }catch(e){ return false } })()
  const useStrict = strictGlobal || strictPerVideo
  const allowSandbox = useStrict && !forceUnsafe

  if(!video) return (
    <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.28}} className="p-5 rounded-lg bg-gradient-to-b from-white to-slate-50 min-h-[260px] flex items-center justify-center">
      <div style={{textAlign:'center'}}>
        <div style={{fontWeight:700}}>No video selected</div>
        <div style={{color:'var(--muted)',marginTop:8}}>Search for videos and hit Play — the player will load here.</div>
      </div>
    </motion.div>
  )
  // initialize YT player for better error detection when not sandboxed
  React.useEffect(()=>{
    let mounted = true
    setError(null)
    setLoading(true)

    // if sandboxed (strict privacy) don't attempt YT API; iframe may be blocked
    if(allowSandbox){ setLoading(false); return }

    // create YT player inside playerRef
    const init = async ()=>{
      try{
        await loadYouTubeApi()
        if(!mounted || !playerRef.current) return
        // destroy previous if exists
        if(ytPlayerRef.current && ytPlayerRef.current.destroy) ytPlayerRef.current.destroy()
        const opts = {
          height: '220',
          width: '100%',
          videoId: video.id,
          playerVars: { rel: 0, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: (ev: any) => { if(!mounted) return; setLoading(false); setError(null) },
            onError: (ev: any) => {
              if(!mounted) return
              setLoading(false)
              const code = ev.data
              let msg = 'Playback failed'
              if(code === 2) msg = 'Invalid parameter.'
              else if(code === 5) msg = 'HTML5 player error.'
              else if(code === 100) msg = 'Video not found.'
              else if(code === 101 || code === 150 || code === 153) msg = 'Embedding disabled by the video owner.'
              else msg = `Playback error (${code})`
              setError({ code, msg })
            }
          }
        }
        // YT.Player needs an element id
        const el = playerRef.current
        el.innerHTML = '<div id="yt-player-root"></div>'
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        ytPlayerRef.current = new (window as any).YT.Player('yt-player-root', opts)
      }catch(err:any){
        // fallback: show iframe instead (some CSPs may block youtube API)
        if(!mounted) return
        setLoading(false)
        setError({ code: 0, msg: 'Unable to load YouTube player — opening fallback iframe.' })
      }
    }

    init()
    return ()=>{ mounted = false; try{ if(ytPlayerRef.current && ytPlayerRef.current.destroy) ytPlayerRef.current.destroy() }catch(e){} }
  }, [video && video.id, allowSandbox])

  function renderFallbackIframe(){
    const src = `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`
    return (
      <iframe
        title={video.title}
        src={src}
        width="100%"
        height={220}
        frameBorder="0"
        loading="lazy"
        referrerPolicy="no-referrer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        {...(allowSandbox ? { sandbox: 'allow-same-origin allow-scripts allow-presentation' } : {})}
      />
    )
  }

  return (
    <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.28}} className="p-4 rounded-lg bg-gradient-to-b from-white to-slate-50">
      <div className="font-semibold truncate">{video.title}</div>

      <div className="mt-3 overflow-hidden rounded-lg relative iframe-wrap">
        {/* player mount point for YT API or fallback */}
        <div ref={playerRef} style={{position:'absolute',inset:0}} />

        {/* show fallback iframe when sandboxed OR when YT API failed to initialize */}
        {allowSandbox ? renderFallbackIframe() : null}

        {/* loading spinner */}
        {loading && <div className="player-overlay" role="status"><div className="spinner" aria-hidden></div></div>}

        {/* error overlay with helpful info and CTAs */}
        {error && (
          <div className="player-overlay" role="alert">
            <div className="msg">
              <h4 style={{marginBottom:6}}>Playback unavailable</h4>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.9)'}}>{error.msg} (code: {error.code})</div>
            </div>
            <div className="player-actions">
              <button className="small" onClick={()=> window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')}>Open on YouTube</button>
              <button className="small" onClick={()=>{ try{ localStorage.removeItem('privacy:override:'+video.id); window.location.reload() }catch(e){} }}>Disable strict privacy</button>
            </div>
          </div>
        )}

        {/* strict privacy overlay with 'Load anyway' CTA */}
        {useStrict && !forceUnsafe && (
          <div className="player-overlay" role="status">
            <div className="msg">
              <h4 style={{marginBottom:6}}>Playback may be restricted</h4>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.9)'}}>Strict privacy is enabled — some players or controls may be limited.</div>
            </div>
            <div className="player-actions">
              <button className="small" onClick={()=>{ try{ localStorage.removeItem('privacy:override:'+video.id); window.location.reload() }catch(e){} }}>Disable for this video</button>
              <button className="cta" onClick={()=> setForceUnsafe(true)}>Load anyway (reduce privacy)</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <motion.a whileHover={{ y: -2 }} className="small primary inline-flex items-center gap-2" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">Open on YouTube</motion.a>
        <motion.button whileTap={{ scale: 0.96 }} whileHover={{ y: -2 }} className="small" onClick={()=> onSave ? onSave(video) : undefined}>Save to Watch Later</motion.button>
      </div>

      {useStrict && <div className="privacy-badge">Strict privacy active <button className="privacy-dismiss" onClick={()=>{ try{ localStorage.removeItem('privacy:override:'+video.id); window.location.reload() }catch(e){} }}>Disable for this video</button></div>}
    </motion.div>
  )
}
