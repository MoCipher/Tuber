import React from 'react'
import { motion } from './lib/motion'

export default function Toast({message='Done', actionLabel, onAction}){
  const msg = typeof message === 'string' ? message : (message && message.message) || 'Done'
  const action = onAction || (typeof message === 'object' && message.onAction)
  const label = actionLabel || (typeof message === 'object' && message.actionLabel)
  return (
    <motion.div
      className="toast fixed bottom-6 right-6 bg-white p-3 rounded-lg shadow-md"
      role="status"
      aria-live="polite"
      initial={{opacity:0, y:18}}
      animate={{opacity:1, y:0}}
      exit={{opacity:0, y:18}}
      whileHover={{ scale: 1.02 }}
      transition={{duration:0.28}}
    >
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{flex:1}}>{msg}</div>
        {action && <button className="small" onClick={action} aria-label={label || 'Action'}>{label || 'Undo'}</button>}
      </div>
    </motion.div>
  )
}
