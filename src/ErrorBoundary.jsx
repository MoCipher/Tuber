import React from 'react'
import { motion } from './lib/motion'

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error){ return { hasError: true, error } }
  componentDidCatch(error, info){ console.error('Uncaught error in component tree', error, info) }
  render(){
    if(this.state.hasError){
      return (
        <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} style={{padding:20}} role="alert">
          <h2>Something went wrong</h2>
          <div style={{color:'#6b7280'}}>{this.state.error && this.state.error.message}</div>
        </motion.div>
      )
    }
    return this.props.children
  }
}
