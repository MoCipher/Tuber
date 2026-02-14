/* Server-safe wrapper for `framer-motion` used by UI components.
   - In the browser we forward to framer-motion.
   - On the server we export lightweight stubs so `renderToStaticMarkup` + tests won't blow up.
*/

type AnyFn = (...args: any[]) => any
const isServer = typeof window === 'undefined'

// default stub used synchronously so imports never see `undefined`.
const stubComponent: AnyFn = (props: any) => (props && props.children) ? props.children : null
const stubFn: AnyFn = (props: any) => props && props.children ? props.children : null
const proxy = new Proxy(stubFn, { get: () => stubFn })

let motion: any = proxy
let AnimatePresence: any = stubComponent

if (!isServer) {
  // runtime/browser: asynchronously load framer-motion and replace the live bindings.
  import('framer-motion').then((fm) => {
    motion = fm.motion || motion
    AnimatePresence = fm.AnimatePresence || AnimatePresence
  }).catch(() => {
    // keep stubs if import fails
  })
} else {
  // server: keep stub (no DOM / animations)
  motion = proxy
}


export { motion, AnimatePresence }
