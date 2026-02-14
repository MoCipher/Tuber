// CommonJS shim so tests that `require('axios')` and the TypeScript server
// both observe the same axios instance (avoids CJS/ESM interop stubbing issues).
module.exports = require('axios')
