#!/usr/bin/env node
// sr-math-lesson (JSONB-first) — STEMROBIN-23: gate-and-save the `en` overlay for
// ALL 16 migrated lessons. Each id runs translate-lesson.mjs in save mode, which
// hard-fails on any i18n gate problem, so partial/bad en data is never left silently.
// Idempotent. Requires each refs/translation/en/<id>.json to already be authored.
//
// Usage (from repo root):
//   --emit : emit every zh worksheet to refs/translation/src/<id>.json (no DB write)
//   (default) : gate-and-save every en overlay
//   node .agents/skills/sr-math-lesson/scripts/translate-all.mjs [--emit]
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const emit = process.argv.slice(2).includes('--emit')
const run = (args) => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' })

const IDS = []
for (const s of [2, 3]) for (let o = 1; o <= 8; o++) IDS.push(`math-s${s}-${String(o).padStart(2, '0')}`)

for (const id of IDS) {
  const args = [join(scriptDir, 'translate-lesson.mjs'), '--id', id]
  if (emit) args.push('--emit')
  run(args)
}

console.log(`\n✓ ${emit ? 'emitted worksheets for' : 'saved en overlays for'} ${IDS.length} lessons`)
