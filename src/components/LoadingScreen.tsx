import React from 'react'
import { motion } from '../lib/motion'

export default function LoadingScreen(){
  return (
    <motion.div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
        style={{ background: 'linear-gradient(90deg,var(--accent),#60a5fa)' }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, repeatType: 'loop' }}
        aria-hidden
      >
        T
      </motion.div>
      <div>
        <div className="font-semibold">Searching YouTube…</div>
        <div className="text-sm text-gray-500">Quick results first — deeper search available.</div>
      </div>
    </motion.div>
  )
}
