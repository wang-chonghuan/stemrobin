#!/usr/bin/env node
// sr-story cap1 — convert a public-domain book (PDF/EPUB/HTML/txt) to markdown via
// Microsoft markitdown. Deterministic: shells out to markitdown; no content editing.
//
// Usage:  node book-to-md.mjs <input-file> <output.md>
// Requires markitdown on PATH:  pip install markitdown   (or pipx install markitdown)
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('usage: book-to-md.mjs <input-file> <output.md>')
  process.exit(2)
}
if (!existsSync(input)) {
  console.error(`✗ input not found: ${input}`)
  process.exit(1)
}

// markitdown is Python; require it explicitly rather than guessing a fallback.
function have(cmd) {
  try { execFileSync('bash', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' }); return true }
  catch { return false }
}
if (!have('markitdown')) {
  console.error('✗ markitdown not found. Install: pip install markitdown (or pipx install markitdown)')
  process.exit(1)
}

let md
try {
  md = execFileSync('markitdown', [input], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
} catch (e) {
  console.error(`✗ markitdown failed: ${(e && e.message) || e}`)
  process.exit(1)
}
if (!md || md.trim().length < 200) {
  console.error(`✗ conversion produced suspiciously little text (${md ? md.length : 0} chars)`)
  process.exit(1)
}
writeFileSync(output, md)
console.log(`✓ wrote ${output} (${Math.round(md.length / 1024)} KB markdown)`)
