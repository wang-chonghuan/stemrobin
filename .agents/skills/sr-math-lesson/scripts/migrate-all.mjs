#!/usr/bin/env node
// sr-math-lesson — STEMROBIN-21: migrate ALL 16 lessons + both ledgers into the
// JSONB SSOT. Idempotent. Runs save-ledger for stage 2/3, then migrate-lesson for
// each lesson id (which snapshots, validates, renders, upserts). Fails fast on the
// first lesson error so partial/bad data is never left silently.
//
// Usage (from repo root):  node .agents/skills/sr-math-lesson/scripts/migrate-all.mjs
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const run = (args) => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' })

const IDS = []
for (const s of [2, 3]) for (let o = 1; o <= 8; o++) IDS.push(`math-s${s}-${String(o).padStart(2, '0')}`)

console.log('== ledgers ==')
run([join(scriptDir, 'save-ledger.mjs'), '--ledger', 'resources/content/math-ledger/stage-2.json'])
run([join(scriptDir, 'save-ledger.mjs'), '--ledger', 'resources/content/math-ledger/stage-3.json'])

console.log('\n== lessons ==')
for (const id of IDS) run([join(scriptDir, 'migrate-lesson.mjs'), '--id', id])

console.log(`\n✓ migrated ${IDS.length} lessons + 2 ledgers`)
