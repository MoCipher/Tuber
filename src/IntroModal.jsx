import React from 'react'
// Inline SVG animation (no external Lottie dependency)

export default function IntroModal({onClose}){
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <svg width="160" height="160" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
              <linearGradient id="g1" x1="0" x2="1"><stop offset="0%" stopColor="#7B61FF"/><stop offset="100%" stopColor="#3ec6ff"/></linearGradient>
            </defs>
            <circle cx="60" cy="60" r="36" fill="url(#g1)" opacity="0.18">
              <animate attributeName="r" from="30" to="40" dur="1.8s" repeatCount="indefinite"/>
            </circle>
            <g>
              <rect x="38" y="40" width="44" height="40" rx="6" fill="#fff" opacity="0.95"/>
              <path d="M50 54v20l18-10-18-10z" fill="#7B61FF">
                <animate attributeName="opacity" values="1;.6;1" dur="1.4s" repeatCount="indefinite"/>
              </path>
            </g>
          </svg>
          <div>
            <h3>Welcome to Tuber</h3>
            <p style={{marginTop:6,color:'#6b7280'}}>No account required. Add a channel to get started.</p>
            <div style={{marginTop:12,display:'flex',gap:8}}>
              <button className="cta" onClick={onClose}>Let's go</button>
              <button className="cta ghost" onClick={()=>{ localStorage.setItem('seenIntro','true'); onClose() }}>Skip</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}