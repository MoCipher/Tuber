import React from 'react'

export default function Onboarding({reduced=false}){
  // Animation implemented as inline animated SVG (no lottie dependency)
  const customSvg = (()=>{ try{ return localStorage.getItem('customSVG') }catch(e){return null} })()
  return (
    <div className="onboarding">
      {reduced ? (
        <svg width="180" height="180" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect width="120" height="120" rx="20" fill="#7B61FF" />
          <path d="M36 40v40l38-20-38-20z" fill="#fff" />
        </svg>
      ) : (
        customSvg ? <div className="custom-svg" dangerouslySetInnerHTML={{__html: customSvg}} /> : (
          <svg width="220" height="220" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden className="intro-anim">
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
        )
      )}
      <div className="onboard-text">
        <h3>Welcome to Tuber</h3>
        <p>Add a channel to begin. No account required.</p>
      </div>
    </div>
  )
}
