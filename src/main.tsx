import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/tailwind.css'

// DEV: filter known noisy third-party console warnings to reduce distraction during development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const origWarn = console.warn.bind(console)
  const origError = console.error.bind(console)
  const suppressed = [
    /Feature Policy:\s*Skipping unsupported feature name/i,
    /unreachable code after return statement/i,
    /Content-Security-Policy/i,
    /Partitioned cookie or storage access/i,
    /WEBGL_debug_renderer_info is deprecated/i,
    /MouseEvent\.mozPressure is deprecated/i,
    /Download the React DevTools for a better development experience/i,
    /^\[vite\] connecting/i,
    /^\[vite\] connected/i
  ]
  function shouldSuppress(msg?: any){
    try{
      const s = String(msg)
      return suppressed.some(re => re.test(s))
    }catch(e){ return false }
  }
  console.warn = function(...args: any[]){ if(!shouldSuppress(args[0])) origWarn(...args) }
  console.error = function(...args: any[]){ if(!shouldSuppress(args[0])) origError(...args) }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
