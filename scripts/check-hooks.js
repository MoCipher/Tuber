#!/usr/bin/env node
// Light repository scan that finds React hook usages (useState, useEffect, etc.)
// where the hook identifier is used directly but NOT imported from 'react'.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const HOOKS = ['useState','useEffect','useMemo','useCallback','useRef','useReducer','useContext','useLayoutEffect','useImperativeHandle']

function walk(dir){
  const out = []
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if(st.isDirectory()) out.push(...walk(p))
    else if(/\.(js|jsx|ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

function parseReactImports(src){
  const named = new Set()
  let hasDefault = false
  let hasNamespace = false

  // import React from 'react'
  if(/import\s+React\s+from\s+['"]react['"]/.test(src)) hasDefault = true
  // import * as React from 'react'
  if(/import\s+\*\s+as\s+React\s+from\s+['"]react['"]/.test(src)) hasNamespace = true
  // const React = require('react')
  if(/const\s+React\s*=\s*require\(['"]react['"]\)/.test(src)) hasDefault = true

  // import { useState, useEffect as useEf } from 'react'
  const m = src.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]react['"]/)
  if(m){
    const parts = m[1].split(',').map(s=>s.trim()).filter(Boolean)
    for(const p of parts){
      const name = p.split(' as ')[0].trim()
      if(name) named.add(name)
    }
  }

  // import React, { useState } from 'react'
  const m2 = src.match(/import\s+React\s*,\s*\{([\s\S]*?)\}\s*from\s*['"]react['"]/)
  if(m2){
    const parts = m2[1].split(',').map(s=>s.trim()).filter(Boolean)
    for(const p of parts){
      const name = p.split(' as ')[0].trim()
      if(name) named.add(name)
    }
  }

  return { named: Array.from(named), hasDefault, hasNamespace }
}

function findViolations(file){
  const src = fs.readFileSync(file, 'utf8')
  const { named, hasDefault, hasNamespace } = parseReactImports(src)
  const violations = []
  const lines = src.split('\n')

  for(let i=0;i<lines.length;i++){
    const line = lines[i]
    for(const hook of HOOKS){
      const re = new RegExp('\\b'+hook+'\\b')
      if(!re.test(line)) continue

      // if hook is imported as named -> ok
      if(named.includes(hook)) continue
      // if used as React.useXxx -> ok (requires default/namespace import)
      if(/React\s*\.\s*/.test(line) && new RegExp('React\\s*\\.\\s*'+hook).test(line)) continue
      // otherwise flagged
      violations.push({ line: i+1, hook, text: line.trim() })
    }
  }

  return violations
}

function main(){
  if(!fs.existsSync(SRC)){
    console.error('No src/ directory found — skipping hook scan')
    process.exit(0)
  }

  const files = walk(SRC)
  let total = 0
  const report = []

  for(const f of files){
    const v = findViolations(f)
    if(v.length){
      total += v.length
      report.push({ file: path.relative(ROOT, f), violations: v })
    }
  }

  if(report.length===0){
    console.log('✅ hook-scan: no missing named React hook imports found')
    process.exit(0)
  }

  console.error('❌ hook-scan: missing named React hook imports detected')
  for(const r of report){
    console.error('\n' + r.file)
    for(const v of r.violations){
      console.error(`  ${v.line}: ${v.hook} — ${v.text}`)
    }
  }
  process.exit(1)
}

if(require.main === module) main()
