import React from 'react'
import { motion } from '../lib/motion'

export default function SearchBar({ value, onChange, onSearch }: any){
  return (
    <motion.form onSubmit={(e)=>{ e.preventDefault(); onSearch(value) }} initial={{opacity:0}} animate={{opacity:1}} className="flex gap-3 items-center">
      <motion.input
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        onKeyDown={(e)=>{ if(e.key==='Enter') onSearch(value) }}
        placeholder="Search videos or paste channel URL"
        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        whileFocus={{ scale: 1.01 }}
        aria-label="Search"
      />
      <motion.button type="submit" className="small primary" whileTap={{ scale: 0.97 }}>Search</motion.button>
    </motion.form>
  )
}
