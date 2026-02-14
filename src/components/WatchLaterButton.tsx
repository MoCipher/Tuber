import React, { useState, useEffect } from 'react'
import { isWatchLater, addWatchLater, removeWatchLater } from '../lib/watchLater'
import { motion } from '../lib/motion'

export default function WatchLaterButton({ id, title, thumbnail }:{ id: string; title?: string; thumbnail?: string }){
  const [saved, setSaved] = useState(false)
  useEffect(()=>{ setSaved(isWatchLater(id)) },[id])
  function toggle(){
    if(saved){ removeWatchLater(id); setSaved(false) }
    else { addWatchLater({ id, title, thumbnail }); setSaved(true) }
  }

  return (
    <motion.button
      role="button"
      aria-pressed={saved}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-300 ${saved ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
      {saved ? (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2"/>
        </svg>
      )}
      <span className="whitespace-nowrap">{saved ? 'Saved' : 'Watch Later'}</span>
    </motion.button>
  )
}
