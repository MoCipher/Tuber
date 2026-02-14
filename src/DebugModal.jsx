import React, { useEffect, useState } from 'react'
import { motion } from './lib/motion'

export default function DebugModal({ onClose }){
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState(null)
  const [enabled, setEnabled] = useState(true)
  const [backoff, setBackoff] = useState(null)
  const [clearingBackoff, setClearingBackoff] = useState(false)
  const [telemetry, setTelemetry] = useState([])
  const [clearingTelemetry, setClearingTelemetry] = useState(false)
  
  async function load(){
    setLoading(true)
    setError(null)
    try{
      const res = await fetch('/api/debug/discover')
      if(!res.ok) throw new Error('failed to fetch')
      const j = await res.json()
      setLogs(j.logs || [])
      setEnabled(typeof j.enabled === 'boolean' ? j.enabled : true)
    }catch(e){ setError(e.message) }

    // load backoff info
    try{
      const r2 = await fetch('/api/debug/backoff')
      if(r2.ok){ const b = await r2.json(); setBackoff(b.backoff || {}) }
    }catch(e){ /* ignore */ }

    // load local telemetry (client-side)
    try{ const t = JSON.parse(localStorage.getItem('searchTelemetry') || '[]'); setTelemetry(t.slice(0,50)) }catch(e){ setTelemetry([]) }

    setLoading(false)
  }

  async function clearLogs(){
    setClearing(true)
    try{
      const res = await fetch('/api/debug/discover/clear', { method: 'POST' })
      if(!res.ok) throw new Error('clear failed')
      setLogs([])
    }catch(e){ setError(e.message) }
    setClearing(false)
  }

  async function clearBackoff(key){
    setClearingBackoff(true)
    try{
      const res = await fetch('/api/debug/backoff/clear', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(key ? { key } : {}) })
      if(!res.ok) throw new Error('clear failed')
      // reload backoff state
      const r2 = await fetch('/api/debug/backoff')
      if(r2.ok){ const b = await r2.json(); setBackoff(b.backoff || {}) }
    }catch(e){ setError(e.message) }
    setClearingBackoff(false)
  }

  async function setCapture(v){
    setError(null)
    try{
      const res = await fetch('/api/debug/discover/set', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ enabled: !!v }) })
      if(!res.ok) throw new Error('set failed')
      const j = await res.json()
      setEnabled(j.enabled)
    }catch(e){ setError(e.message) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Discovery debug logs">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Discovery debug (dev-only)</h3>
          <button className="cta ghost" onClick={onClose}>Close</button>
        </div>
        <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>This shows recent discovery scraping samples captured by the server. Only available in development.</div>
        <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
          <label style={{display:'inline-flex',alignItems:'center',gap:8}}><input type="checkbox" checked={enabled} onChange={(e)=>setCapture(e.target.checked)} /> Capture logs</label>
          <div style={{fontSize:12,color:'#9ca3af'}}>{enabled? 'On' : 'Off'}</div>
        </div>
        <div style={{marginTop:12, maxHeight:360, overflow:'auto'}}>
          {loading && <div className="empty">Loading…</div>}
          {error && <div className="error">{error}</div>}

          <div style={{marginBottom:8}}>
            <div style={{fontWeight:700}}>Discovery logs</div>
            {!loading && logs && logs.length===0 && <div className="empty">No debug logs</div>}
            {!loading && logs && logs.map((l, idx)=> (
              <div key={idx} style={{padding:10,borderRadius:8,background:'#fff',marginBottom:8,boxShadow:'0 8px 20px rgba(12,18,33,0.04)'}}>
                <div style={{fontSize:12,color:'#6b7280'}}>{new Date(l.ts).toLocaleString()} — q: <strong>{l.q}</strong></div>
                <div style={{marginTop:6,fontSize:13}}>
                  <div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>Anchors sample:</div>
                  <ul style={{margin:0,paddingLeft:14}}>
                    {(l.sampleHrefs||[]).map((h,i)=> <li key={i}><code style={{fontFamily:'monospace'}}>{h}</code></li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div style={{marginTop:8}}>
            <div style={{fontWeight:700}}>Search telemetry (recent)</div>
            {!telemetry || telemetry.length===0 ? (
              <div className="empty">No telemetry captured</div>
            ) : (
              telemetry.map((t, i)=> (
                <div key={i} style={{padding:10,borderRadius:8,background:'#fff',marginBottom:8,boxShadow:'0 8px 20px rgba(12,18,33,0.04)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                    <div style={{fontSize:12,color:'#6b7280'}}>{new Date(t.timestamp).toLocaleString()} — <strong>{t.q}</strong></div>
                    <div style={{fontSize:12,color:'#6b7280'}}>{t.durationMs} ms</div>
                  </div>
                  <div style={{marginTop:8,fontSize:13}}>
                    <div><strong>Result:</strong> {t.resultType} {t.confidence ? `· ${(t.confidence*100).toFixed(0)}%` : ''}</div>
                    <div style={{marginTop:6,fontSize:12,color:'#6b7280'}}>Steps: {Object.keys(t.steps||{}).join(', ')}</div>
                  </div>
                </div>
              ))
            )}
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="small" onClick={()=>{ try{ const t = JSON.parse(localStorage.getItem('searchTelemetry')||'[]'); setTelemetry(t.slice(0,50)) }catch(e){ setTelemetry([]) } }}>Refresh telemetry</button>
              <button className="small" onClick={()=>{ setClearingTelemetry(true); try{ localStorage.removeItem('searchTelemetry'); setTelemetry([]) }catch(e){} setClearingTelemetry(false) }}>{clearingTelemetry ? 'Clearing…' : 'Clear telemetry'}</button>
            </div>
          </div>

          <div style={{marginTop:8}}>
            <div style={{fontWeight:700}}>Backoff state</div>
            {!backoff && <div style={{fontSize:12,color:'#9ca3af'}}>No backoff data</div>}
            {backoff && Object.keys(backoff).length===0 && <div className="empty">No active backoff entries</div>}
            {backoff && Object.keys(backoff).map((k)=> (
              <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:8,marginTop:8,background:'#fff',borderRadius:8}}>
                <div style={{fontSize:12}}>
                  <div style={{fontWeight:700}}>{k}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>Failures: {backoff[k].failures} • last: {backoff[k].lastErrorAt ? new Date(backoff[k].lastErrorAt).toLocaleString() : 'n/a'}</div>
                  <div style={{fontSize:12,color:'#9ca3af'}}>Remaining: {Math.ceil((backoff[k].remainingMs||0)/1000)}s • next delay: {Math.ceil((backoff[k].nextDelayMs||0)/1000)}s</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="small" onClick={()=>clearBackoff(k)} disabled={clearingBackoff}>Clear</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="small" onClick={load} disabled={loading}>Refresh</button>
          <button className="small" onClick={clearLogs} disabled={clearing || (logs && logs.length===0)}>{clearing ? 'Clearing…' : 'Clear logs'}</button>
          <button className="small" onClick={()=>clearBackoff()} disabled={clearingBackoff}>{clearingBackoff ? 'Clearing…' : 'Clear all backoff'}</button>
        </div>
      </div>
    </div>
  )
}
