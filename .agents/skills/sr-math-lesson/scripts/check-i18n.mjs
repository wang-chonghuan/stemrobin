#!/usr/bin/env node
// sr-math-lesson (JSONB-first) — STEMROBIN-23 deterministic gate for a per-locale
// TRANSLATION overlay (e.g. `en`) validated against its `zh` SOURCE overlay.
// Postgres does not constrain JSONB internals, so this script is the enforcement
// point for the translation contract (ssot-schemas/db-schemas/stemrobin.sql +
// seed G8 / plan D15): only prose is translated; formulas, inline SVG, markup and
// numeric literals inherit from the source byte-for-byte; the overlay is prose-only
// and never carries an answer KEY.
//
// Checks (all HARD — any problem => refuse to persist):
//   - coverage: en node_id set == zh node_id set exactly (no missing, no extra).
//   - shape: every en entry is { t: string, src_rev: int }.
//   - KEY secrecy: no en entry carries correct_index / accept / answer (KEY_FIELDS).
//   - formula fidelity: the ORDERED list of $…$ / $$…$$ math spans is byte-identical
//     between the zh and en string of each node.
//   - SVG fidelity: the ORDERED list of <svg>…</svg> blocks is byte-identical
//     (inline SVG is neutral — never translated).
//   - markup fidelity: the multiset of remaining HTML tags (after removing svg+math)
//     is identical, so no tag was dropped, added, or altered.
//   - residual-CJK: after removing svg blocks, math spans and HTML tags, no Han/CJK
//     character remains in a translated en string (catches untranslated leftovers).
//     SVG inner text and math are intentionally exempt (they are neutral).
//
// Usage:
//   node check-i18n.mjs --zh zh.json --en en.json --id math-s2-01
//   (programmatic) import { validateI18n } from './check-i18n.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { KEY_FIELDS } from './check-content.mjs'

// CJK ideographs + CJK/fullwidth punctuation — a translated en string must contain none
// of these outside a neutral span (SVG/math).
const CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/

// Extract, in document order, every atomic neutral span of one kind.
function svgBlocks(s) { return s.match(/<svg[\s\S]*?<\/svg>/gi) || [] }
function mathSpans(s) {
  // $$…$$ (block) tried before $…$ (inline); neither delimiter body may contain a bare $.
  return s.match(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g) || []
}
// Remainder after stripping neutral spans — the surface that must be pure translated prose+markup.
function stripNeutral(s) { return s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, ' ') }
function htmlTags(s) { return (s.match(/<\/?[a-zA-Z][^>]*>/g) || []) }
const bag = (arr) => [...arr].sort()
const eqList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// Validate an `en` (or any target-locale) overlay against the `zh` source overlay.
// Returns string[] problems (empty = ok). Neither argument is mutated.
export function validateI18n({ zh, en, id = '' }) {
  const problems = []
  const tag = id ? `${id}: ` : ''
  if (!zh || typeof zh !== 'object') { problems.push(`${tag}zh source overlay must be an object`); return problems }
  if (!en || typeof en !== 'object') { problems.push(`${tag}en overlay must be an object`); return problems }

  const zhKeys = new Set(Object.keys(zh))
  const enKeys = new Set(Object.keys(en))
  for (const k of zhKeys) if (!enKeys.has(k)) problems.push(`${tag}missing node "${k}" (present in zh source)`)
  for (const k of enKeys) if (!zhKeys.has(k)) problems.push(`${tag}extra node "${k}" (absent from zh source)`)

  for (const [nid, entry] of Object.entries(en)) {
    const et = `${tag}en["${nid}"]`
    if (!entry || typeof entry !== 'object') { problems.push(`${et} must be { t, src_rev }`); continue }
    if (typeof entry.t !== 'string') problems.push(`${et}.t must be a string`)
    if (!Number.isInteger(entry.src_rev)) problems.push(`${et}.src_rev must be an integer`)
    for (const kf of KEY_FIELDS) if (kf in entry) problems.push(`${et} leaks answer KEY field "${kf}" — KEY must stay in the neutral base`)
    if (typeof entry.t !== 'string') continue
    const src = zh[nid]
    if (!src || typeof src.t !== 'string') continue // missing/extra already reported
    const zt = src.t, xt = entry.t
    // formula fidelity
    if (!eqList(mathSpans(zt), mathSpans(xt)))
      problems.push(`${et}: math spans differ from zh source (formulas must be byte-identical). zh=${JSON.stringify(mathSpans(zt))} en=${JSON.stringify(mathSpans(xt))}`)
    // inline-SVG fidelity
    if (!eqList(svgBlocks(zt), svgBlocks(xt)))
      problems.push(`${et}: inline <svg> blocks differ from zh source (SVG is neutral, never translated)`)
    // markup fidelity (after removing neutral spans)
    if (!eqList(bag(htmlTags(stripNeutral(zt))), bag(htmlTags(stripNeutral(xt)))))
      problems.push(`${et}: HTML tag set differs from zh source (markup must be preserved). zh=${JSON.stringify(bag(htmlTags(stripNeutral(zt))))} en=${JSON.stringify(bag(htmlTags(stripNeutral(xt))))}`)
    // residual CJK on the translated surface
    const surface = stripNeutral(xt).replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    if (CJK_RE.test(surface)) {
      const leftover = (surface.match(new RegExp(CJK_RE.source, 'g')) || []).join('')
      problems.push(`${et}: untranslated CJK residue "${leftover}" (translate all prose; only SVG/formula stay in the source language)`)
    }
  }
  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const args = {}
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
  if (!args.zh || !args.en) { console.error('usage: check-i18n.mjs --zh zh.json --en en.json [--id id]'); process.exit(2) }
  const rd = (p, what) => { const fp = resolve(process.cwd(), p); if (!existsSync(fp)) { console.error(`✗ ${what} not found: ${p}`); process.exit(1) } try { return JSON.parse(readFileSync(fp, 'utf8')) } catch (e) { console.error(`✗ ${what} JSON: ${e.message}`); process.exit(1) } }
  const problems = validateI18n({ zh: rd(args.zh, 'zh'), en: rd(args.en, 'en'), id: args.id })
  if (problems.length) { console.error('✗ i18n check failed:'); for (const m of problems) console.error(`  - ${m}`); process.exit(1) }
  console.log(`✓ i18n ok: ${args.id || ''} · coverage == zh · formulas/SVG/markup byte-identical · KEY-free · no CJK residue`)
}
