import React from 'react'
import { motion } from './lib/motion'

export default function SimilarList({channels=[], loading=false, onPlay, onSubscribe, lastUpdated, prefs=new Map(), onBoostUp, onBoostDown, onToggleIgnore, recentBoosted=new Set()}){
  return (
    <div>
      <h4 style={{marginTop:0}}>Similar channels</h4>
      <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>{ lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleString()}` : '' }</div>
      {loading && <div className="empty">Loading similar channels…</div>}
      {!loading && channels.length===0 && <div className="empty">No similar channels found</div>}
      <div style={{display:'grid',gap:8}}>
        {channels.map(c => {
          const p = prefs.get(c.channelTitle) || { boost: 1, ignore: false }
          return (
            <motion.div key={c.channelId || c.channelTitle} initial={recentBoosted && recentBoosted.has(c.channelTitle) ? {scale:0.96,opacity:0.9} : {}} animate={recentBoosted && recentBoosted.has(c.channelTitle) ? {scale:[1,1.04,1],boxShadow:['0 0 0 rgba(0,0,0,0)','0 18px 40px rgba(59,130,246,0.08)','0 0 0 rgba(0,0,0,0)']} : {}} transition={{duration:0.8}} style={{display:'flex',gap:8,alignItems:'center',padding:8,borderRadius:8,background:'#fff'}}>
              <div style={{width:72,height:44,background:'#eee',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                { c.channelThumb ? <img src={c.channelThumb} alt={`${c.channelTitle} avatar`} style={{width:72,height:44,objectFit:'cover',borderRadius:6}} /> : <div style={{fontSize:10,color:'#6b7280'}}>{c.channelTitle ? c.channelTitle.slice(0,2) : 'CH'}</div> }
              </div>
              <div style={{flex:1, border: p.boost>1.4 ? '2px solid rgba(59,130,246,0.12)' : undefined, padding: p.boost>1.4 ? '6px' : undefined, borderRadius:6}}>
                <div style={{fontWeight:700}}>{c.channelTitle}</div>
                {c.latestVideo && <div style={{fontSize:12,color:'#6b7280'}}>{c.latestVideo.title}</div>}
                <div style={{marginTop:6,fontSize:12,color:'#6b7280'}}>Boost: {(p.boost||1).toFixed(2)}x {p.ignore? ' • Ignored' : ''}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'flex',gap:6}}>
                  <button className="tiny" onClick={()=>onBoostDown && onBoostDown(c.channelTitle)}>-</button>
                  <button className="tiny" onClick={()=>onBoostUp && onBoostUp(c.channelTitle)}>+</button>
                </div>
                {c.latestVideo && <button className="small" onClick={()=>onPlay && onPlay(c.latestVideo)}>Play</button>}
                <div style={{display:'flex',gap:6}}>
                  <button className="small" onClick={()=>onSubscribe && onSubscribe(c.channelTitle)}>Subscribe</button>
                  <button className={`small ${p.ignore? 'active' : ''}`} onClick={()=>onToggleIgnore && onToggleIgnore(c.channelTitle)}>{p.ignore? 'Unignore' : 'Ignore'}</button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
