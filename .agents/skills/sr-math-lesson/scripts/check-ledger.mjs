#!/usr/bin/env node
// sr-math-lesson — deterministic ledger validation: schema, uniqueness, and the
// prerequisite-closure rule (every consumed term must be introduced earlier or
// assumed). Optional --vocab <lesson.html> --id <lesson-id>: greps the HTML for
// terms owned by LATER lessons (a mechanical slice of the vocabulary contract).
//
// Usage:
//   node check-ledger.mjs resources/content/math-ledger/stage-2.json
//   node check-ledger.mjs resources/content/math-ledger/stage-2.json --vocab <lesson.html> --id math-s2-05
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function fail(msgs) {
  console.error('✗ ledger check failed:')
  for (const m of msgs) console.error(`  - ${m}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const jsonPath = args[0]
if (!jsonPath) { console.error('usage: check-ledger.mjs <ledger.json> [--vocab <html> --id <lesson-id>]'); process.exit(2) }
const opt = {}
for (let i = 1; i < args.length; i++) if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1]; i++ }

const p = resolve(process.cwd(), jsonPath)
if (!existsSync(p)) fail([`not found: ${jsonPath}`])
let ledger
try { ledger = JSON.parse(readFileSync(p, 'utf8')) } catch (e) { fail([`JSON parse error: ${e.message}`]) }

const problems = []

// --- schema ---
if (ledger.subject !== 'math') problems.push('subject must be "math"')
if (!Number.isInteger(ledger.stage)) problems.push('stage must be an integer')
if (!ledger.theme) problems.push('missing theme')
if (!ledger.model || ledger.model.length < 10) problems.push('missing/empty model (the stage\'s central mental model)')
if (!Array.isArray(ledger.assumed)) problems.push('assumed must be an array')
if (!Array.isArray(ledger.lessons) || !ledger.lessons.length) problems.push('lessons must be a non-empty array')
if (problems.length) fail(problems)

const GENRES = ['概念课', '方法课', '练习课']
const STATUSES = ['planned', 'generated', 'published']
const assumedTerms = new Set()
for (const [i, a] of ledger.assumed.entries()) {
  if (!a.concept || !a.from) problems.push(`assumed[${i}]: concept/from required`)
  else assumedTerms.add(a.concept)
  if (a.from === 'GAP' && !a.note) problems.push(`assumed[${i}] (${a.concept}): GAP entries need a note`)
}

const seenIds = new Set()
const ownedBy = new Map() // term -> lesson id
let prevOrder = 0
for (const [i, l] of ledger.lessons.entries()) {
  const tag = `lessons[${i}] (${l.id || '?'})`
  if (!l.id || !new RegExp(`^math-s${ledger.stage}-\\d{2}$`).test(l.id)) problems.push(`${tag}: id must look like math-s${ledger.stage}-03`)
  if (seenIds.has(l.id)) problems.push(`${tag}: duplicate id`)
  seenIds.add(l.id)
  if (!Number.isInteger(l.order) || l.order <= prevOrder) problems.push(`${tag}: order must be a strictly increasing integer`)
  prevOrder = l.order ?? prevOrder
  if (!l.title) problems.push(`${tag}: missing title`)
  if (!GENRES.includes(l.genre)) problems.push(`${tag}: genre must be one of ${GENRES.join('|')}`)
  if (!STATUSES.includes(l.status)) problems.push(`${tag}: status must be one of ${STATUSES.join('|')}`)
  if (!l.core_idea) problems.push(`${tag}: missing core_idea`)
  if (!Array.isArray(l.introduces)) problems.push(`${tag}: introduces must be an array (may be empty for 练习课)`)
  if (!Array.isArray(l.consumes)) problems.push(`${tag}: consumes must be an array`)
  if (l.genre === '概念课' && (!Array.isArray(l.boundary_cases) || l.boundary_cases.length < 2))
    problems.push(`${tag}: 概念课 needs >=2 boundary_cases`)

  // term ownership (uniqueness) + closure
  for (const intro of l.introduces || []) {
    if (!intro.term || !['概念', '方法'].includes(intro.kind)) { problems.push(`${tag}: introduces entries need {term, kind:概念|方法}`); continue }
    if (ownedBy.has(intro.term)) problems.push(`${tag}: term "${intro.term}" already introduced by ${ownedBy.get(intro.term)}`)
    if (assumedTerms.has(intro.term)) problems.push(`${tag}: term "${intro.term}" is already in assumed`)
  }
  for (const c of l.consumes || []) {
    if (!ownedBy.has(c) && !assumedTerms.has(c))
      problems.push(`${tag}: consumes "${c}" — not introduced by any earlier lesson and not in assumed (closure violation)`)
  }
  // register AFTER consuming so a lesson cannot consume its own introductions
  for (const intro of l.introduces || []) if (intro.term) ownedBy.set(intro.term, l.id)
}

// --- optional vocab slice: later-lesson terms must not appear in this lesson's HTML ---
if (opt.vocab) {
  if (!opt.id) fail(['--vocab requires --id <lesson-id>'])
  const hp = resolve(process.cwd(), opt.vocab)
  if (!existsSync(hp)) fail([`vocab html not found: ${opt.vocab}`])
  const html = readFileSync(hp, 'utf8')
  const idx = ledger.lessons.findIndex((l) => l.id === opt.id)
  if (idx === -1) fail([`--id ${opt.id} not in ledger`])
  for (const later of ledger.lessons.slice(idx + 1)) {
    for (const intro of later.introduces || []) {
      if (intro.term && html.includes(intro.term))
        problems.push(`vocab: "${intro.term}" belongs to LATER lesson ${later.id} but appears in ${opt.id}'s html`)
    }
  }
}

if (problems.length) fail(problems)
console.log(`✓ ledger ok: stage ${ledger.stage} · ${ledger.lessons.length} lessons · ${ownedBy.size} terms owned · closure holds${opt.vocab ? ' · vocab slice clean' : ''}`)
