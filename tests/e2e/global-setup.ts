import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const PID_FILE = path.resolve(__dirname, '../../.server.pid')

export default async function globalSetup() {
  const port = process.env.TEST_API_PORT || '4001'
  const healthUrl = `http://localhost:${port}/api/health`

  // if a server is already running and healthy, reuse it (prevents spawn races)
  try{
    const res = await fetch(healthUrl)
    if(res && res.ok){ console.log(`e2e: API server already healthy on port ${port} — skipping spawn`); return }
  }catch(e){ /* not running yet */ }

  console.log(`e2e: starting API server (TEST_FIXTURES=1, PORT=${port}) using server:prod`)
  const child = spawn('npm', ['run', 'server:prod'], {
    env: { ...process.env, TEST_FIXTURES: '1', PORT: String(port) },
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
  fs.writeFileSync(PID_FILE, String(child.pid))

  // wait for server health
  // Increase wait attempts for CI / slower machines (240 * 250ms = 60s total)
  const max = 240
  for(let i=0;i<max;i++){
    try{
      const res = await fetch(healthUrl)
      if(res && res.ok){ console.log('e2e: API server ready'); return }
    }catch(e){}
    await new Promise(r=>setTimeout(r, 250))
  }
  throw new Error('e2e: API server did not start in time (waited ~60s)')
}
