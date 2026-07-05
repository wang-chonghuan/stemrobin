#!/usr/bin/env node
// sr-story — deterministic 正文 length check for a chapter Markdown file.
// Counts Chinese characters (CJK Unified Ideographs) in the narrative. The floor
// is 2000 (~10 minutes of reading). Used by the gate and by save-story.mjs.
//
// Usage:  node .agents/skills/sr-story/scripts/wordcount.mjs <chapter.md> [min]
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const MIN_HANZI = 2000

export function countHanzi(md) {
  const m = md.match(/[一-鿿]/g)
  return m ? m.length : 0
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]
  const min = Number(process.argv[3] || MIN_HANZI)
  if (!file) {
    console.error('usage: wordcount.mjs <chapter.md> [min]')
    process.exit(2)
  }
  const p = resolve(process.cwd(), file)
  if (!existsSync(p)) {
    console.error(`✗ not found: ${file}`)
    process.exit(2)
  }
  const n = countHanzi(readFileSync(p, 'utf8'))
  if (n < min) {
    console.error(`✗ 正文 too short: ${n} 汉字 (need ≥ ${min}). Mine more real detail from the book md.`)
    process.exit(1)
  }
  console.log(`✓ 正文 ${n} 汉字 (≥ ${min})`)
}
