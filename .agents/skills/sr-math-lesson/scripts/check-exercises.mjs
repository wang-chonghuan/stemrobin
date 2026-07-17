#!/usr/bin/env node
// sr-math-lesson (JSONB-first) — deterministic validation of the exercise-deck
// `exercises` JSONB ({ items: [...] }) + its prose overlay. Preserves the
// historical deck composition rules (counts, layer shares, review tail,
// review_of closure) on the new JSONB item shape documented in
// ssot-schemas/db-schemas/stemrobin.sql. The gate judges meaning; this guards shape.
//
// Usage (CLI, ledger from a file for dev):
//   node check-exercises.mjs --exercises e.json --overlay o.json --ledger stage.json --id math-s99-01
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { earlierTermsFor } from './ledger-core.mjs'
import { validateItemKey } from './check-content.mjs'
import { validateFigure } from './figure.mjs'
import { exerciseModes } from './question-policy.mjs'

const LAYERS = ['指认', '操作', '辨错', '说理', '复习']
const TYPES = ['辨认', '表示', '操作', '反推', '辨错', '说理']

// Validate exercises + overlay against the ledger. Returns string[] problems.
export function validateExercises({ exercises, overlay, ledger, id }) {
  const problems = []
  if (!exercises || !Array.isArray(exercises.items)) { problems.push('exercises.items must be an array'); return problems }
  if (!overlay || typeof overlay !== 'object') { problems.push('overlay must be an object'); return problems }
  const has = (nid) => Object.prototype.hasOwnProperty.call(overlay, nid)

  const { idx, terms: earlierTerms } = earlierTermsFor(ledger, id)
  if (idx === -1) { problems.push(`--id ${id} not in ledger`); return problems }
  const isFirstLesson = idx === 0

  const items = exercises.items
  if (items.length < 16 || items.length > 24) problems.push(`deck must have 16–24 items (got ${items.length})`)

  const ords = new Set()
  const seenIds = new Set()
  const count = { layer: {}, mode: {} }
  items.forEach((q, i) => {
    const tag = `item[${i}] (ord ${q.ord ?? '?'} / ${q.id || '?'})`
    if (!q.id) problems.push(`${tag}: missing id`)
    else { if (seenIds.has(q.id)) problems.push(`${tag}: duplicate item id ${q.id}`); seenIds.add(q.id) }
    if (!Number.isInteger(q.ord) || ords.has(q.ord)) problems.push(`${tag}: ord must be a unique integer`)
    ords.add(q.ord)
    if (!Number.isInteger(q.rev)) problems.push(`${tag}: rev must be an integer`)
    if (!TYPES.includes(q.type)) problems.push(`${tag}: type must be one of ${TYPES.join('|')}`)
    if (!LAYERS.includes(q.layer)) problems.push(`${tag}: layer must be one of ${LAYERS.join('|')}`)
    if (!has(q.id)) problems.push(`${tag}: prompt id "${q.id}" has no overlay entry`)
    count.layer[q.layer] = (count.layer[q.layer] || 0) + 1
    count.mode[q.mode] = (count.mode[q.mode] || 0) + 1

    // Choice-only policy (STEMROBIN-25, reversible): allowed modes come from
    // question-policy.mjs; validateItemKey keeps its input/work branches for when
    // the policy re-enables them. allowAnswer=true: a deck item carries its
    // post-answer `answer` reveal (projected to sr_questions.answer at save).
    validateItemKey(problems, tag, q, overlay, has, exerciseModes(), true)

    // optional figure spec (a figure-bearing exercise): validate it renders
    if (q.figure) for (const p of validateFigure(q.figure, `${tag} figure`)) problems.push(p)

    if (q.layer === '复习') {
      if (!q.review_of) problems.push(`${tag}: 复习 items need review_of`)
      else if (!earlierTerms.has(q.review_of)) problems.push(`${tag}: review_of "${q.review_of}" is not an earlier-lesson/assumed term`)
    } else if (q.review_of != null) problems.push(`${tag}: review_of only on 复习 items`)
  })

  const sorted = [...ords].sort((a, b) => a - b)
  if (sorted.length && (sorted[0] !== 1 || sorted[sorted.length - 1] !== sorted.length)) problems.push('ord must be contiguous starting at 1')

  const n = items.length
  const pct = (k) => (count.layer[k] || 0) / n
  if (pct('指认') < 0.25) problems.push(`指认 layer must be >=25% (got ${Math.round(pct('指认') * 100)}%)`)
  if (pct('操作') < 0.20) problems.push(`操作 layer must be >=20% (got ${Math.round(pct('操作') * 100)}%)`)
  if ((count.layer['辨错'] || 0) < 2) problems.push('need >=2 辨错 items')
  if ((count.layer['说理'] || 0) < 2) problems.push('need >=2 说理 items')
  if (!isFirstLesson && (count.layer['复习'] || 0) < 3) problems.push("need >=3 复习 items (this is not the stage's first lesson)")

  return { problems, count }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const args = {}
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
  if (!args.exercises || !args.overlay || !args.ledger || !args.id) { console.error('usage: check-exercises.mjs --exercises e.json --overlay o.json --ledger stage.json --id <lesson-id>'); process.exit(2) }
  const rd = (p, what) => { const fp = resolve(process.cwd(), p); if (!existsSync(fp)) { console.error(`✗ ${what} not found: ${p}`); process.exit(1) } try { return JSON.parse(readFileSync(fp, 'utf8')) } catch (e) { console.error(`✗ ${what} JSON: ${e.message}`); process.exit(1) } }
  const { problems, count } = validateExercises({ exercises: rd(args.exercises, 'exercises'), overlay: rd(args.overlay, 'overlay'), ledger: rd(args.ledger, 'ledger'), id: args.id })
  if (problems.length) { console.error('✗ deck check failed:'); for (const m of problems) console.error(`  - ${m}`); process.exit(1) }
  console.log(`✓ deck ok: ${count && Object.keys(count.layer).length ? `layers ${JSON.stringify(count.layer)} · modes ${JSON.stringify(count.mode)}` : ''}`)
}
