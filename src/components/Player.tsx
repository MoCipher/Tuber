import React from 'react'
import { motion } from '../lib/motion'

export default function Player({ video, onSave }:{ video?: any; onSave?: (v:any)=>void }){
  if(!video) return (
    <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.28}} className="p-5 rounded-lg bg-gradient-to-b from-white to-slate-50 min-h-[260px] flex items-center justify-center">
      <div style={{textAlign:'center'}}>
        <div style={{fontWeight:700}}>No video selected</div>
        <div style={{color:'var(--muted)',marginTop:8}}>Search for videos and hit Play — the player will load here.</div>
      </div>
    </motion.div>
  )

  // determine whether strict privacy is enabled for this session or for this video
  const strictGlobal = (()=>{ try{ return localStorage.getItem('privacy:strict') === '1' }catch(e){ return false } })()
  const strictPerVideo = (()=>{ try{ return localStorage.getItem(`privacy:override:${video.id}`) === '1' }catch(e){ return false } })()
  const useStrict = strictGlobal || strictPerVideo

  return (
    <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.28}} className="p-4 rounded-lg bg-gradient-to-b from-white to-slate-50">
      <div className="font-semibold truncate">{video.title}</div>
      <div className="mt-3 overflow-hidden rounded-lg relative iframe-wrap">
        <iframe
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          width="100%"
          height={220}
          frameBorder="0"
          loading="lazy"
          referrerPolicy="no-referrer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          {...(useStrict ? { sandbox: 'allow-same-origin allow-scripts allow-presentation' } : {})}
        />
        <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1 }} className="absolute inset-0 pointer-events-none" aria-hidden />
      </div>
      <div className="flex gap-2 mt-3">
        <motion.a whileHover={{ y: -2 }} className="small primary inline-flex items-center gap-2" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">Open on YouTube</motion.a>
        <motion.button whileTap={{ scale: 0.96 }} whileHover={{ y: -2 }} className="small" onClick={()=> onSave ? onSave(video) : undefined}>Save to Watch Later</motion.button>
      </div>
      {useStrict && <div className="privacy-badge">Strict privacy active <button className="privacy-dismiss" onClick={()=>{ try{ localStorage.removeItem('privacy:override:'+video.id); window.location.reload() }catch(e){} }}>Disable for this video</button></div>}
    </motion.div>
  )
}
