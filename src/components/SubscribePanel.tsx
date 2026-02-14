import React, { useState } from 'react'
import { getSubscriptions, addSubscription, removeSubscription, toggleRecommend } from '../lib/subscriptions'
import { motion, AnimatePresence } from '../lib/motion'

const row = {
  hidden: { opacity: 0, y: -6 },
  show: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 }
}

export default function SubscribePanel(){
  const [subs, setSubs] = useState(() => getSubscriptions())
  const [input, setInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  async function resolveInputToCanonical(val: string){
    // try direct feed lookup when input looks like a channel id or URL first
    const idMatch = String(val).trim().match(/^(UC[\w-]{22,})$/i)
    if(idMatch){
      try{
        const res = await fetch(`/api/feed?channel_id=${encodeURIComponent(idMatch[1])}`)
        if(res.ok){ const j = await res.json(); const feed = j.feed || j; return { value: idMatch[1], title: feed.title || val } }
      }catch(e){}
    }

    // try parsing URLs like /channel/<id> or /user/<user> or /@handle
    try{
      const u = new URL(val)
      const parts = u.pathname.split('/').filter(Boolean)
      if(parts.length){
        const last = parts[parts.length-1]
        // try channel id first
        try{ const r = await fetch(`/api/feed?channel_id=${encodeURIComponent(last)}`); if(r.ok){ const j = await r.json(); const feed = j.feed || j; return { value: last, title: feed.title || val } } }catch(e){}
        // try user fallback
        try{ const r2 = await fetch(`/api/feed?user=${encodeURIComponent(last)}`); if(r2.ok){ const j2 = await r2.json(); const feed = j2.feed || j2; return { value: last, title: feed.title || val } } }catch(e){}
      }
    }catch(e){}

    // fallback to discovery endpoint (may return canonical id)
    try{
      const res = await fetch(`/api/discover?q=${encodeURIComponent(val)}&aggressive=1`)
      if(!res.ok) return null
      const j = await res.json()
      if(j && j.type === 'feed' && j.id){
        const title = (j.feed && (j.feed.title || j.feed.title)) || val
        return { value: String(j.id), title }
      }
      return null
    }catch(e){ return null }
  }

  async function add(){
    if(!input) return
    setResolving(true)
    setStatusMsg('Resolving...')

    let canonical = null
    try{ canonical = await resolveInputToCanonical(input) }catch(e){ canonical = null }

    if(canonical){
      const next = addSubscription({ value: canonical.value, title: canonical.title || input, recommend: true })
      setSubs(next)
      setInput('')
      setStatusMsg('Added (resolved)')
      try{ window.dispatchEvent(new CustomEvent('subscriptions:changed', { detail: next })) }catch(e){}
      setTimeout(()=> setStatusMsg(''), 1800)
      setResolving(false)
      return
    }

    // fallback: add the raw value but inform the user it could not be auto-resolved
    const next = addSubscription({ value: input, title: input, recommend: true })
    setSubs(next)
    setInput('')
    setStatusMsg('Added (unverified)')
    try{ window.dispatchEvent(new CustomEvent('subscriptions:changed', { detail: next })) }catch(e){}
    setTimeout(()=> setStatusMsg(''), 1800)
    setResolving(false)
  }

  function rem(v:string){ const next = removeSubscription(v); setSubs(next); try{ window.dispatchEvent(new CustomEvent('subscriptions:changed', { detail: next })) }catch(e){} }
  function toggle(v:string){ const next = toggleRecommend(v); setSubs(next); try{ window.dispatchEvent(new CustomEvent('subscriptions:changed', { detail: next })) }catch(e){} }

  return (
    <motion.div className="p-3 bg-white rounded-md shadow-sm" initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="channel id or handle"
          className="flex-1 px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-200"
          aria-label="Add subscription"
          disabled={resolving}
        />
        <button onClick={add} disabled={resolving} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">{resolving ? 'Adding…' : 'Subscribe'}</button>
      </div>
      {statusMsg && <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>{statusMsg}</div>}

      <div className="space-y-2 text-sm" aria-live="polite">
        {subs.length===0 && <div className="text-gray-500">No subscriptions yet</div>}
        <AnimatePresence initial={false}>
          {subs.map(s=> (
            <motion.div key={s.value} layout initial="hidden" animate="show" exit="exit" variants={row} transition={{ duration: 0.18 }} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div className="truncate">{s.title || s.value}</div>
              <div className="flex gap-2">
                <button
                  onClick={()=>toggle(s.value)}
                  className={`px-2 py-1 rounded ${s.recommend? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}
                >
                  {s.recommend? 'Recommend' : 'Mute'}
                </button>
                <button onClick={()=>rem(s.value)} className="px-2 py-1 bg-red-50 text-red-600 rounded">Remove</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
