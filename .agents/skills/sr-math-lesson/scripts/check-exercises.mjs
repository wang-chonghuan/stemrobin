#!/usr/bin/env node
// sr-math-lesson — deterministic deck validation: item shape (choice/input/work),
// composition rules (layer shares, recall share, review tail), and review_of
// targets against the ledger. The gate judges meaning; this guards shape.
//
// Usage:
//   node check-exercises.mjs <deck.json> --ledger resources/content/math-ledger/stage-2.json --id math-s2-05
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function fail(msgs) {
  console.error('✗ deck check failed:')
  for (const m of msgs) console.error(`  - ${m}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const deckPath = args[0]
if (!deckPath) { console.error('usage: check-exercises.mjs <deck.json> --ledger <ledger.json> --id <lesson-id>'); process.exit(2) }
const opt = {}
for (let i = 1; i < args.length; i++) if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1]; i++ }
if (!opt.ledger || !opt.id) fail(['--ledger and --id are required'])

let deck, ledger
try { deck = JSON.parse(readFileSync(resolve(process.cwd(), deckPath), 'utf8')) } catch (e) { fail([`deck JSON: ${e.message}`]) }
try { ledger = JSON.parse(readFileSync(resolve(process.cwd(), opt.ledger), 'utf8')) } catch (e) { fail([`ledger JSON: ${e.message}`]) }

const idx = ledger.lessons.findIndex((l) => l.id === opt.id)
if (idx === -1) fail([`--id ${opt.id} not in ledger`])
const earlierTerms = new Set(ledger.assumed.map((a) => a.concept))
for (const l of ledger.lessons.slice(0, idx)) for (const t of l.introduces || []) earlierTerms.add(t.term)
const isFirstLesson = idx === 0

const LAYERS = ['指认', '操作', '辨错', '说理', '复习']
const TYPES = ['辨认', '表示', '操作', '反推', '辨错', '说理']
const MODES = ['choice', 'input', 'work']
const problems = []

if (!Array.isArray(deck)) fail(['deck must be a JSON array'])
if (deck.length < 16 || deck.length > 24) problems.push(`deck must have 16–24 items (got ${deck.length})`)

const ords = new Set()
const count = { layer: {}, mode: {} }
deck.forEach((q, i) => {
  const tag = `item[${i}] (ord ${q.ord ?? '?'})`
  if (!Number.isInteger(q.ord) || ords.has(q.ord)) problems.push(`${tag}: ord must be a unique integer`)
  ords.add(q.ord)
  if (!q.prompt || !q.prompt.trim()) problems.push(`${tag}: missing prompt`)
  if (!TYPES.includes(q.type)) problems.push(`${tag}: type must be one of ${TYPES.join('|')}`)
  if (!LAYERS.includes(q.layer)) problems.push(`${tag}: layer must be one of ${LAYERS.join('|')}`)
  if (!MODES.includes(q.answer_mode)) problems.push(`${tag}: answer_mode must be one of ${MODES.join('|')}`)
  if (!q.answer || String(q.answer).trim().length < 2) problems.push(`${tag}: answer must be a substantive explanation`)
  count.layer[q.layer] = (count.layer[q.layer] || 0) + 1
  count.mode[q.answer_mode] = (count.mode[q.answer_mode] || 0) + 1

  if (q.answer_mode === 'choice') {
    if (!Array.isArray(q.options) || q.options.length < 3) problems.push(`${tag}: choice needs >=3 options`)
    else if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length)
      problems.push(`${tag}: correct_index out of range`)
    if (q.accept != null) problems.push(`${tag}: choice must not carry accept`)
  } else if (q.answer_mode === 'input') {
    if (!Array.isArray(q.accept) || !q.accept.length || q.accept.some((a) => typeof a !== 'string' || !a.trim()))
      problems.push(`${tag}: input needs a non-empty accept array of strings`)
    if (q.options != null || q.correct_index != null) problems.push(`${tag}: input must not carry options/correct_index`)
  } else { // work
    if (q.options != null || q.correct_index != null || q.accept != null) problems.push(`${tag}: work must not carry options/correct_index/accept`)
  }

  if (q.layer === '复习') {
    if (!q.review_of) problems.push(`${tag}: 复习 items need review_of`)
    else if (!earlierTerms.has(q.review_of)) problems.push(`${tag}: review_of "${q.review_of}" is not an earlier-lesson/assumed term`)
  } else if (q.review_of != null) problems.push(`${tag}: review_of only on 复习 items`)
})

// ords contiguous from 1
const sorted = [...ords].sort((a, b) => a - b)
if (sorted[0] !== 1 || sorted[sorted.length - 1] !== sorted.length) problems.push('ord must be contiguous starting at 1')

// composition
const n = deck.length
const pct = (k) => (count.layer[k] || 0) / n
if (pct('指认') < 0.25) problems.push(`指认 layer must be >=25% (got ${Math.round(pct('指认') * 100)}%)`)
if (pct('操作') < 0.20) problems.push(`操作 layer must be >=20% (got ${Math.round(pct('操作') * 100)}%)`)
if ((count.layer['辨错'] || 0) < 2) problems.push('need >=2 辨错 items')
if ((count.layer['说理'] || 0) < 2) problems.push('need >=2 说理 items')
if (!isFirstLesson && (count.layer['复习'] || 0) < 3) problems.push('need >=3 复习 items (this is not the stage\'s first lesson)')
const recallPool = (count.mode.input || 0) + (count.mode.choice || 0)
if (recallPool && (count.mode.input || 0) / recallPool < 0.40)
  problems.push(`input must be >=40% of input+choice (got ${Math.round(((count.mode.input || 0) / recallPool) * 100)}%)`)
deck.filter((q) => q.layer === '说理').forEach((q, i) => {
  if (q.answer_mode !== 'work') problems.push(`说理 item (ord ${q.ord}) must be answer_mode work`)
})

if (problems.length) fail(problems)
console.log(`✓ deck ok: ${n} items · layers ${JSON.stringify(count.layer)} · modes ${JSON.stringify(count.mode)}`)
