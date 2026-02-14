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

  function add(){
    if(!input) return
    const next = addSubscription({ value: input, title: input, recommend: true })
    setSubs(next)
    setInput('')
  }
  function rem(v:string){ setSubs(removeSubscription(v)) }
  function toggle(v:string){ setSubs(toggleRecommend(v)) }

  return (
    <motion.div className="p-3 bg-white rounded-md shadow-sm" initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="channel id or handle"
          className="flex-1 px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-200"
          aria-label="Add subscription"
        />
        <button onClick={add} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">Subscribe</button>
      </div>

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
