import fs from 'fs'
import path from 'path'

const PID_FILE = path.resolve(__dirname, '../../.server.pid')

export default async function globalTeardown(){
  try{
    if(fs.existsSync(PID_FILE)){
      const pid = Number(fs.readFileSync(PID_FILE,'utf8'))
      try{ process.kill(pid, 'SIGKILL') }catch(e){}
      fs.unlinkSync(PID_FILE)
      console.log('e2e: killed API server pid', pid)
    }
  }catch(e){ console.error('e2e: teardown failed', e) }
}
