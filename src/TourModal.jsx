import React, {useState} from 'react'

const steps = [
  {title:'Privacy', body:'Use the Privacy toggle to reduce tracking from embedded players. Try strict privacy for sandboxed playback (may limit some features).'},
  {title:'Digest', body:'Open Daily Digest to see the top 20 recommendations and recent uploads. Use Not interested to adjust recommendations.'},
  {title:'Subscribe', body:'Search for channels or Paste a channel URL in the search box, then click Subscribe from results or the player.'}
]

export default function TourModal({onClose}){
  const [i,setI] = useState(0)
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{steps[i].title}</h3>
        <p style={{color:'#6b7280'}}>{steps[i].body}</p>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="small" onClick={()=>setI(Math.max(0,i-1))} disabled={i===0}>Back</button>
          <button className="small" onClick={()=>{ if(i===steps.length-1) onClose(); else setI(i+1) }}>{i===steps.length-1? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}