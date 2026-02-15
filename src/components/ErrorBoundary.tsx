import React from 'react'

type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<{}, State> {
  constructor(props: {}){
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(){ return { hasError: true } }
  componentDidCatch(error: any, info: any){ console.error('ErrorBoundary caught', error, info) }
  reset = () => { this.setState({ hasError: false }); window.location.reload() }

  render(){
    if(this.state.hasError){
      return (
        <div style={{padding:20, borderRadius:12, background:'linear-gradient(90deg,#fff4f6,#f4fbff)', boxShadow:'0 12px 30px rgba(12,18,33,0.06)'}}>
          <div style={{fontWeight:700,marginBottom:6}}>Something went wrong in this panel</div>
          <div style={{color:'#6b7280',marginBottom:12}}>The player failed to render correctly. Try reloading or open the video on YouTube.</div>
          <div style={{display:'flex',gap:8}}>
            <button className="small" onClick={this.reset}>Reload</button>
            <button className="small" onClick={()=> window.open('/', '_self')}>Close</button>
          </div>
        </div>
      )
    }
    return this.props.children as React.ReactElement
  }
}
