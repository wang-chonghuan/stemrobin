#!/usr/bin/env node
// sr-math-lesson — lesson BLUEPRINT gate (STEMROBIN-51). The blueprint is the
// per-lesson plan the agent produces BEFORE authoring full prose/figures, so
// structural and figure-necessity problems are caught early (事中/草案检验),
// not after a whole lesson is written.
//
// The blueprint is where the agent makes its representation judgment EXPLICIT and
// checkable: it declares the lesson's DOMAIN (with a rationale) and, per section,
// exactly which figures it will draw and WHY each is load-bearing. There is NO
// figure-count floor and NO preset — geometry lessons plan figures where the
// objects are spatial; algebra lessons legitimately plan few or none. The gate
// enforces the discipline instead:
//   - every declared figure carries a non-empty `why` → no gratuitous figure (废图)
//   - the domain judgment is stated with a rationale (no silent default)
//   - sections cover the genre anchors; the deck is planned
// The complementary "a spatial claim is MISSING its figure (缺图)" is a semantic
// call left to the blueprint reviewer pass — the deterministic gate cannot know a
// claim is spatial, but it can force every figure to justify itself and force the
// domain to be reasoned, which is what stops the algebra-default from recurring.
//
// Usage:
//   node check-blueprint.mjs bp.json --ledger stage.json [--id math-s10-01]
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ANCHORS } from './check-content.mjs'

const WHY_MIN = 12 // a `why` shorter than this is not a real justification

export function validateBlueprint({ blueprint, ledger, id }) {
  const problems = []
  const bp = blueprint
  if (!bp || typeof bp !== 'object') { problems.push('blueprint must be an object'); return problems }
  const lid = id || bp.id
  const entry = (ledger?.lessons || []).find((l) => l.id === lid)
  if (!entry) problems.push(`blueprint id "${lid}" is not in the ledger`)
  if (entry && bp.genre && bp.genre !== entry.genre) problems.push(`blueprint genre "${bp.genre}" != ledger genre "${entry.genre}"`)
  const genre = bp.genre || entry?.genre
  const anchors = ANCHORS[genre]
  if (!anchors) { problems.push(`unknown/absent genre "${genre}"`); return problems }

  // domain judgment must be explicit + reasoned (no silent algebra default)
  if (typeof bp.domain !== 'string' || !bp.domain.trim()) problems.push('blueprint must declare `domain` (agent judgment: geometry|algebra|statistics|…)')
  if (typeof bp.domain_rationale !== 'string' || bp.domain_rationale.trim().length < WHY_MIN) problems.push('`domain_rationale` must explain the domain judgment (why this lesson\'s objects are/ aren\'t spatial)')

  // sections cover the genre anchors, in order
  const secAnchors = (bp.sections || []).map((s) => s.anchor)
  if (secAnchors.join('|') !== anchors.join('|')) problems.push(`blueprint sections ${JSON.stringify(secAnchors)} must equal ${genre} anchors ${JSON.stringify(anchors)} in order`)

  // every declared figure must justify itself (废图 guard) — this is the whole point
  let totalFigs = 0
  for (const s of bp.sections || []) {
    for (const [i, f] of (s.figures || []).entries()) {
      totalFigs++
      const tag = `section ${s.anchor} figure[${i}]${f.id ? ' ' + f.id : ''}`
      if (typeof f.why !== 'string' || f.why.trim().length < WHY_MIN) problems.push(`${tag}: every figure needs a substantive \`why\` (是否必要，缺则为废图) — got ${JSON.stringify(f.why ?? null)}`)
      if (f.kind && !['geometry', 'numberline'].includes(f.kind)) problems.push(`${tag}: figure kind "${f.kind}" unknown (geometry|numberline)`)
    }
  }

  // deck plan present; any figure-bearing item justifies its figure too
  const dp = bp.deck_plan
  if (!dp || typeof dp !== 'object') problems.push('blueprint must carry a `deck_plan` (at least n_items)')
  else {
    if (!Number.isInteger(dp.n_items) || dp.n_items < 16 || dp.n_items > 24) problems.push('deck_plan.n_items must be 16–24')
    for (const [i, fi] of (dp.figure_items || []).entries()) {
      if (typeof fi.why !== 'string' || fi.why.trim().length < WHY_MIN) problems.push(`deck_plan.figure_items[${i}] (ord ${fi.ord ?? '?'}): a figure-bearing exercise needs a \`why\` (离开图无法作答)`)
    }
  }
  return { problems, totalFigs, figureItems: (dp?.figure_items || []).length, domain: bp.domain }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [bpPath, ...rest] = process.argv.slice(2)
  const args = {}
  for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { args[rest[i].slice(2)] = rest[i + 1]; i++ } }
  const rd = (p, w) => { const fp = resolve(process.cwd(), p); if (!existsSync(fp)) { console.error(`✗ ${w} not found: ${p}`); process.exit(1) } try { return JSON.parse(readFileSync(fp, 'utf8')) } catch (e) { console.error(`✗ ${w} JSON: ${e.message}`); process.exit(1) } }
  if (!bpPath || !args.ledger) { console.error('usage: check-blueprint.mjs bp.json --ledger stage.json [--id id]'); process.exit(2) }
  const { problems, totalFigs, figureItems, domain } = validateBlueprint({ blueprint: rd(bpPath, 'blueprint'), ledger: rd(args.ledger, 'ledger'), id: args.id })
  if (problems.length) { console.error('✗ blueprint check failed:'); for (const p of problems) console.error(`  - ${p}`); process.exit(1) }
  console.log(`✓ blueprint ok: ${args.id || '(id)'} · domain=${domain} · ${totalFigs} 課文图 · ${figureItems} 图题 · all figures justified`)
}
