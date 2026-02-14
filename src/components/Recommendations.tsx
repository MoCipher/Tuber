import React, { useMemo } from 'react'
import { extractKeywords } from '../lib/recommend'
import { getWatchLater } from '../lib/watchLater'
import { motion, AnimatePresence } from '../lib/motion'

const chip = { hidden: { opacity: 0, y: -6, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 6, scale: 0.97 } }

export default function Recommendations({ onPick }:{ onPick?: (q:string)=>void }){
  const watch = getWatchLater()
  const keywords = useMemo(()=> extractKeywords(watch.map(w=>w.title || ''), 6), [watch])
  if(keywords.length===0) return <div className="p-3 text-sm text-gray-500">No recommendations yet — save videos to get smarter suggestions</div>
  return (
    <div className="p-3 bg-white rounded-md shadow-sm">
      <div className="text-sm font-semibold mb-2">Recommended keywords</div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {keywords.map(k=> (
            <motion.button
              key={k}
              layout
              initial="hidden"
              animate="show"
              exit="exit"
              variants={chip}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={()=> onPick && onPick(k)}
              className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {k}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
