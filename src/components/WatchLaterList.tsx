import React, { useState, useEffect } from 'react'
import { getWatchLater, removeWatchLater, WatchLaterItem } from '../lib/watchLater'
import { motion, AnimatePresence } from '../lib/motion'

const itemVariants = {
  hidden: { opacity: 0, x: -8, scale: 0.99 },
  enter: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 8, scale: 0.98 }
}

export default function WatchLaterList({ onPlay }:{ onPlay?: (id:string)=>void }){
  const [items, setItems] = useState<WatchLaterItem[]>(() => getWatchLater())

  useEffect(()=>{
    // update list if localStorage changes in other tabs
    const onStorage = () => setItems(getWatchLater())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },[])

  function handleRemove(id: string){
    const next = removeWatchLater(id)
    setItems(next)
  }

  if(items.length===0) return <div className="p-4 text-sm text-gray-500">No items saved for later</div>

  return (
    <div className="p-3 space-y-2">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map(it=> (
          <motion.div
            key={it.id}
            layout
            initial="hidden"
            animate="enter"
            exit="exit"
            variants={itemVariants}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="flex items-center gap-3 bg-white p-2 rounded-md shadow-sm"
          >
            <img src={it.thumbnail} alt={it.title || 'thumbnail'} className="w-14 h-10 object-cover rounded-md flex-shrink-0" />
            <div className="flex-1 text-sm min-w-0">
              <div className="font-semibold truncate">{it.title || it.id}</div>
              <div className="text-xs text-gray-500">Saved {new Date(it.addedAt||0).toLocaleDateString()}</div>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                onClick={()=> onPlay && onPlay(it.id)}
              >
                Play
              </button>
              <button
                className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                onClick={()=> handleRemove(it.id)}
              >
                Remove
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
