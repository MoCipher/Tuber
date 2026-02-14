import React from 'react'
import { motion } from './lib/motion'

export default function DigestModal({items, onClose}){
  return (
    <div className="modal-overlay">
      <motion.div className="modal" initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} exit={{y:12,opacity:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Daily Digest</h3>
          <button className="cta ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{marginTop:12,maxHeight:420,overflow:'auto'}}>
          {items.length===0 && <div className="empty">No items in digest</div>}
          {items.map(it=> (
            <div key={it.id} style={{display:'flex',gap:12,alignItems:'center',padding:8,borderRadius:8}}>
              <img src={it.thumbnail} style={{width:120,height:68,objectFit:'cover',borderRadius:8}} />
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{it.title}</div>
                <div style={{fontSize:12,color:'#6b7280'}}>{it.channelTitle} • {new Date(it.published).toLocaleString()}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button className="small" onClick={()=>{ window.postMessage({type:'play', id: it.id}, '*') }}>Play</button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}