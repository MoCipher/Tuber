import React, { useState, useEffect } from 'react'
import SearchBar from './components/SearchBar'
import Player from './components/Player'
import LoadingScreen from './components/LoadingScreen'
import Toast from './Toast'
import WatchLaterList from './components/WatchLaterList'
import SubscribePanel from './components/SubscribePanel'
import Recommendations from './components/Recommendations'
import { addWatchLater } from './lib/watchLater'
import { motion, AnimatePresence } from './lib/motion'

export default function App(){
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [current, setCurrent] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(()=>{
    // nothing to do yet — storage-backed helpers handle persistence
  },[])

  async function doSearch(q: string){
    setError(null)
    setLoading(true)
    try{
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if(res.ok){
        const j = await res.json()
        const feed = j.feed || j
        const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : [])
        setResults(entries.map((e:any)=>({ id: e['yt:videoId'] || (e.id && e.id.split(':').pop()), title: e.title, thumbnail: (e['media:group'] && e['media:group']['media:thumbnail'] && e['media:group']['media:thumbnail']['@_url']) || '' })))
      } else {
        setResults([])
      }
    }catch(e){ console.error(e); setError('Network error — please try again') }
    setLoading(false)
  }

  function onPlayId(id: string){
    const found = results.find(r=>r.id===id)
    setCurrent(found || { id })
  }

  return (
    <div className="app-root">
      <div style={{display:'flex',gap:20}}>
        <div style={{flex:1}}>
          <h1 style={{margin:0}}>Tuber</h1>
          <p style={{color:'var(--muted)'}}>Privacy-first, local-first YouTube frontend — now in TypeScript.</p>
          <SearchBar value={query} onChange={setQuery} onSearch={doSearch} />
          <div style={{marginTop:20}}>
            {loading ? <LoadingScreen /> : (
              <>
                {error && (
                  <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} className="mb-3 p-3 bg-red-50 text-red-700 rounded">
                    {error}
                  </motion.div>
                )}

                <motion.div layout className="grid grid-cols-2 gap-3">
                  <AnimatePresence initial={false}>
                    {results.map(r=> (
                      <motion.div
                        key={r.id}
                        layout
                        initial={{opacity:0, y:6}}
                        animate={{opacity:1, y:0}}
                        exit={{opacity:0, y:-6}}
                        whileHover={{ scale: 1.02 }}
                        transition={{type:'spring', stiffness:400, damping:28}}
                        className="relative p-3 bg-white rounded-lg shadow-sm overflow-hidden"
                      >
                        <div className="relative rounded-md overflow-hidden">
                          <img src={r.thumbnail} className="w-full h-28 object-cover rounded-md" />
                          <motion.div
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="absolute inset-0 bg-black/30 flex items-center justify-center gap-3"
                            aria-hidden
                          >
                            <motion.button whileTap={{ scale: 0.96 }} className="px-3 py-1 bg-white text-sm rounded" onClick={()=> onPlayId(r.id)}>Play</motion.button>
                            <motion.button whileTap={{ scale: 0.96 }} className="px-3 py-1 bg-gray-100 text-sm rounded" onClick={()=>{ addWatchLater({ id: r.id, title: r.title, thumbnail: r.thumbnail }); setResults(rs=>[...rs]) }}>Watch Later</motion.button>
                          </motion.div>
                        </div>

                        <div className="mt-3 font-semibold truncate">{r.title}</div>
                        <div className="flex gap-2 mt-3 opacity-0 hover:opacity-100 transition-opacity duration-150">
                          <button className="small" onClick={()=> onPlayId(r.id) }>Play</button>
                          <button className="small" onClick={()=>{ addWatchLater({ id: r.id, title: r.title, thumbnail: r.thumbnail }); setResults(rs=>[...rs]) }}>Watch Later</button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
          </div>
        </div>
        <div style={{width:420}}>
          <Player video={current} onSave={(v)=>{ addWatchLater({ id: v.id, title: v.title, thumbnail: v.thumbnail }); setToast('Saved to Watch Later'); setTimeout(()=>setToast(null), 1600) }} />
          <div style={{marginTop:16}}>
            <div style={{marginBottom:8}}><strong>Watch later</strong></div>
            <div className="bg-white rounded-md shadow-sm">
              {/* WatchLaterList reads localStorage directly so it stays simple */}
              <WatchLaterList onPlay={onPlayId} />
            </div>
          </div>

          <div style={{marginTop:16}}>
            <div style={{marginBottom:8}}><strong>Subscriptions</strong></div>
            <SubscribePanel />
          </div>

          <div style={{marginTop:16}}>
            <div style={{marginBottom:8}}><strong>Recommendations</strong></div>
            <Recommendations onPick={(q: string) => doSearch(q)} />
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {toast && <Toast key="toast" message={toast} />}
      </AnimatePresence>
    </div>
  )
}
