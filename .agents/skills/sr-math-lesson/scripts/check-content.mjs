#!/usr/bin/env node
// sr-math-lesson (JSONB-first) — deterministic validation of the card-tree
// `content` JSONB + the per-locale prose `overlay`. Postgres does not constrain
// JSONB internals, so this script is the enforcement point for the documented
// content contract (ssot-schemas/db-schemas/stemrobin.sql):
//   - genre section anchors present + ordered
//   - every card has a learner-visible `num`; nums unique + contiguous from 1
//   - every SUBSTANTIAL card carries >=1 read_check (D-SUBSTANTIAL)
//   - read_check items well-formed per mode; each references overlay prose
//   - body prose nodes reference overlay; formula/svg nodes are neutral (inline)
//   - KEY secrecy: the overlay carries ONLY prose ({t, src_rev}); no
//     correct_index / accept / answer ever appears in the overlay
//
// Usage:
//   node check-content.mjs --content c.json --overlay o.json --genre 方法课 --id math-s99-01
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Genre section anchors (ordered) — the fixed, validated card boundaries.
export const ANCHORS = {
  概念课: ['motivation', 'model', 'anatomy', 'boundary', 'connections', 'oral'],
  方法课: ['motivation', 'explain', 'examples', 'connections', 'oral'],
  练习课: ['motivation'],
}
// Substantial cards (must carry read-check): teaching anchors that are reading
// targets — excludes `oral` (a self-quiz) and the 练习课 orientation.
export const SUBSTANTIAL = {
  概念课: ['motivation', 'model', 'anatomy', 'boundary', 'connections'],
  方法课: ['motivation', 'explain', 'examples', 'connections'],
  练习课: [],
}
const KEY_FIELDS = ['correct_index', 'accept', 'answer']

// Validate content + overlay for one lesson. Returns string[] problems (empty = ok).
export function validateContent({ content, overlay, genre, id }) {
  const problems = []
  const anchors = ANCHORS[genre]
  if (!anchors) { problems.push(`unknown genre ${genre}`); return problems }
  if (!content || !Array.isArray(content.cards) || !content.cards.length) { problems.push('content.cards must be a non-empty array'); return problems }
  if (!overlay || typeof overlay !== 'object') { problems.push('overlay must be an object'); return problems }

  // overlay KEY-secrecy + shape: every entry is prose only.
  for (const [nid, entry] of Object.entries(overlay)) {
    if (!entry || typeof entry !== 'object' || typeof entry.t !== 'string')
      problems.push(`overlay["${nid}"] must be { t: string, src_rev? }`)
    else for (const kf of KEY_FIELDS) if (kf in entry) problems.push(`overlay["${nid}"] leaks answer KEY field "${kf}" — KEY must stay in the neutral base`)
  }

  const has = (nid) => Object.prototype.hasOwnProperty.call(overlay, nid)
  const cards = content.cards
  const cardAnchors = cards.map((c) => c.anchor)
  if (cardAnchors.join('|') !== anchors.join('|'))
    problems.push(`card anchors ${JSON.stringify(cardAnchors)} must equal ${genre} anchors ${JSON.stringify(anchors)} in order`)

  const seenCardIds = new Set()
  const seenNums = []
  const seenNodeIds = new Set()
  const substantial = SUBSTANTIAL[genre]

  cards.forEach((c, i) => {
    const tag = `card[${i}] (${c.id || '?'} / ${c.anchor || '?'})`
    if (!c.id || typeof c.id !== 'string') problems.push(`${tag}: missing string id`)
    else if (seenCardIds.has(c.id)) problems.push(`${tag}: duplicate card id`)
    seenCardIds.add(c.id)
    if (!Number.isInteger(c.num)) problems.push(`${tag}: num (编号) must be an integer`)
    else seenNums.push(c.num)
    if (!Number.isInteger(c.rev)) problems.push(`${tag}: rev must be an integer`)
    if (!Array.isArray(c.body) || !c.body.length) problems.push(`${tag}: body must be a non-empty array`)

    for (const [j, n] of (c.body || []).entries()) {
      const ntag = `${tag} body[${j}]`
      if (n.kind === 'prose') {
        if (!n.id) { problems.push(`${ntag}: prose node needs id`); continue }
        if (seenNodeIds.has(n.id)) problems.push(`${ntag}: duplicate node id ${n.id}`)
        seenNodeIds.add(n.id)
        if (!has(n.id)) problems.push(`${ntag}: prose id "${n.id}" has no overlay entry`)
      } else if (n.kind === 'formula') {
        if (!n.tex) problems.push(`${ntag}: formula node needs tex`)
        if (n.id && has(n.id)) problems.push(`${ntag}: formula must be neutral (not in overlay)`)
      } else if (n.kind === 'svg') {
        if (!n.svg || !/<svg[\s>]/i.test(n.svg)) problems.push(`${ntag}: svg node needs inline <svg> markup`)
        if (n.caption_id && !has(n.caption_id)) problems.push(`${ntag}: svg caption_id "${n.caption_id}" has no overlay entry`)
      } else problems.push(`${ntag}: unknown body node kind "${n.kind}"`)
    }

    const rc = c.read_check
    if (substantial.includes(c.anchor)) {
      if (!Array.isArray(rc) || rc.length < 1) problems.push(`${tag}: substantial card needs >=1 read_check`)
    }
    for (const [j, item] of (rc || []).entries()) {
      const rtag = `${tag} read_check[${j}] (${item.id || '?'})`
      if (!item.id) problems.push(`${rtag}: missing id`)
      else { if (seenNodeIds.has(item.id)) problems.push(`${rtag}: duplicate node id ${item.id}`); seenNodeIds.add(item.id) }
      if (!Number.isInteger(item.rev)) problems.push(`${rtag}: rev must be an integer`)
      if (item.id && !has(item.id)) problems.push(`${rtag}: prompt id "${item.id}" has no overlay entry`)
      validateItemKey(problems, rtag, item, overlay, has, ['choice', 'input'])
    }
  })

  const sortedNums = [...seenNums].sort((a, b) => a - b)
  if (new Set(seenNums).size !== seenNums.length) problems.push('card num values must be unique')
  if (sortedNums.length && (sortedNums[0] !== 1 || sortedNums[sortedNums.length - 1] !== sortedNums.length))
    problems.push(`card num must be contiguous from 1 (got ${JSON.stringify(sortedNums)})`)

  return problems
}

// Shared item key/option validation for read_check + exercises (choice|input|work).
export function validateItemKey(problems, tag, item, overlay, has, allowedModes) {
  if (!allowedModes.includes(item.mode)) { problems.push(`${tag}: mode must be one of ${allowedModes.join('|')}`); return }
  if (!item.key || typeof item.key !== 'object') { problems.push(`${tag}: missing key`); return }
  if (item.mode === 'choice') {
    if (!Array.isArray(item.options) || item.options.length < 2) problems.push(`${tag}: choice needs an options[] of >=2 node ids`)
    else for (const optId of item.options) if (!has(optId)) problems.push(`${tag}: option id "${optId}" has no overlay entry`)
    if (!Number.isInteger(item.key.correct_index) || item.key.correct_index < 0 || (Array.isArray(item.options) && item.key.correct_index >= item.options.length))
      problems.push(`${tag}: choice key.correct_index out of range`)
    if ('accept' in item.key || 'answer' in item.key) problems.push(`${tag}: choice key must be only { correct_index }`)
  } else if (item.mode === 'input') {
    if (!Array.isArray(item.key.accept) || !item.key.accept.length) problems.push(`${tag}: input key needs accept[] of strings`)
    if ('correct_index' in item.key) problems.push(`${tag}: input key must be only { accept }`)
  } else if (item.mode === 'work') {
    if (typeof item.key.answer !== 'string' || !item.key.answer.trim()) problems.push(`${tag}: work key needs a reference answer string`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const args = {}
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
  if (!args.content || !args.overlay || !args.genre) { console.error('usage: check-content.mjs --content c.json --overlay o.json --genre <概念课|方法课|练习课> [--id id]'); process.exit(2) }
  const rd = (p, what) => { const fp = resolve(process.cwd(), p); if (!existsSync(fp)) { console.error(`✗ ${what} not found: ${p}`); process.exit(1) } try { return JSON.parse(readFileSync(fp, 'utf8')) } catch (e) { console.error(`✗ ${what} JSON: ${e.message}`); process.exit(1) } }
  const problems = validateContent({ content: rd(args.content, 'content'), overlay: rd(args.overlay, 'overlay'), genre: args.genre, id: args.id })
  if (problems.length) { console.error('✗ content check failed:'); for (const m of problems) console.error(`  - ${m}`); process.exit(1) }
  console.log(`✓ content ok: ${args.id || ''} · ${args.genre} · anchors + num + read-check + overlay(KEY-free) valid`)
}
