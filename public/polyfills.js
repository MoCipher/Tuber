// Minimal, safe polyfills used by the app (only when native support is missing).
// Purpose: remove dependency on the external polyfill.io service in dev and CI.
;(function(){
  // Array.prototype.includes
  if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
      value: function(search, fromIndex) {
        if (this == null) throw new TypeError('Array.prototype.includes called on null or undefined')
        const o = Object(this)
        const len = parseInt(o.length, 10) || 0
        if (len === 0) return false
        let n = parseInt(fromIndex, 10) || 0
        let k = Math.max(n >= 0 ? n : len - Math.abs(n), 0)
        while (k < len) {
          if (o[k] === search || (Number.isNaN(search) && Number.isNaN(o[k]))) return true
          k++
        }
        return false
      }
    })
  }

  // Object.assign
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) throw new TypeError('Cannot convert undefined or null to object')
      const to = Object(target)
      for (let i = 1; i < arguments.length; i++) {
        const next = arguments[i]
        if (next != null) {
          for (const key in next) if (Object.prototype.hasOwnProperty.call(next, key)) to[key] = next[key]
        }
      }
      return to
    }
  }

  // Element.prototype.closest
  if (typeof Element !== 'undefined' && !Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
      let el = this
      while (el && el.nodeType === 1) {
        if (el.matches && el.matches(selector)) return el
        el = el.parentElement || el.parentNode
      }
      return null
    }
  }

  // IntersectionObserver — provide a tiny noop fallback so code that expects it won't throw.
  if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
    window.IntersectionObserver = function () {
      function IO() {}
      IO.prototype.observe = function(){}
      IO.prototype.unobserve = function(){}
      IO.prototype.disconnect = function(){}
      return IO
    }()
  }

  // Provide a tiny fetch fallback (XHR) only if window.fetch is missing.
  if (typeof window !== 'undefined' && !window.fetch) {
    window.fetch = function(url, opts) {
      return new Promise(function(resolve, reject){
        try{
          const xhr = new XMLHttpRequest()
          xhr.open(opts && opts.method ? opts.method : 'GET', url, true)
          if (opts && opts.headers) Object.keys(opts.headers).forEach(k=>xhr.setRequestHeader(k, opts.headers[k]))
          xhr.onload = function(){
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: () => Promise.resolve(xhr.responseText), json: () => Promise.resolve(JSON.parse(xhr.responseText||'null')), headers: { get: (h) => xhr.getResponseHeader(h) } })
          }
          xhr.onerror = function(){ reject(new TypeError('Network request failed')) }
          xhr.send(opts && opts.body ? opts.body : null)
        }catch(e){ reject(e) }
      })
    }
  }
})()
