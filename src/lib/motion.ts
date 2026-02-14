/* Server-safe wrapper for `framer-motion` used by UI components.
   - In the browser we forward to framer-motion.
   - On the server we export lightweight stubs so `renderToStaticMarkup` + tests won't blow up.
*/

type AnyFn = (...args: any[]) => any
const isServer = typeof window === 'undefined'

let motion: any
let AnimatePresence: any = ({ children }: any) => children

if (!isServer) {
  // browser/runtime: use real framer-motion
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fm = require('framer-motion')
  motion = fm.motion
  AnimatePresence = fm.AnimatePresence || AnimatePresence
} else {
  // server: no-op/stub that returns children for SSR
  const stub: AnyFn = (props: any) => props && props.children ? props.children : null
  const proxy = new Proxy(stub, { get: () => stub })
  motion = proxy
}

export { motion, AnimatePresence }
