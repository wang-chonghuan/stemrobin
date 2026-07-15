#!/usr/bin/env node
// sr-math-lesson — TEMPORARY, deterministic restore of each card's section
// display name (中文名) into the `content` JSONB (STEMROBIN-34).
//
// Why: the STEMROBIN-21 migration split each lesson's teaching sections into
// card nodes but DROPPED the per-section Chinese display name — a card now has
// id/num/anchor/rev/body/read_check but NO `name`. The original names still
// live in the migration snapshots (main) as
//   <section data-sr-section="ANCHOR"> … <span class="sr-sec-name">中文名</span> …
// one per teaching section, in order. This script parses each snapshot, builds
// the (anchor → name) map, and writes `name` onto the matching card in
// `sr_lessons.content`. It ONLY adds the `name` field: prose, body, read_check,
// exercises, title, and every other column are left byte-for-byte intact.
//
// Deterministic + idempotent: re-running re-derives the same names from the same
// snapshots and produces the same content. Reversible: before mutating, each
// lesson's current `content` JSONB is written to
//   .intentmill/tickets/STEMROBIN-34-restore-titles/refs/content-backup/<id>.json
// The `sr_users` table is never touched.
//
// Usage (from repo root or anywhere in the repo):
//   node .agents/skills/sr-math-lesson/scripts/restore-section-names.mjs [--check]
//   --check : dry-run — extract + diff, prove coverage, write NOTHING to the DB.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, repoRoot } from './db.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))

// PURE: snapshot HTML → ordered [{ anchor, name }] for every teaching section.
// The section open tag is exactly `<section data-sr-section="ANCHOR">`; the
// display name is the FIRST `<span class="sr-sec-name">…</span>` inside that
// section (part of its `.sr-sec-label`). Sections with no name span are skipped
// (defensive — every real teaching/practice section carries one).
export function extractSectionNames(html) {
  const out = []
  const secRe = /<section data-sr-section="([a-zA-Z0-9_-]+)"\s*>/g
  const opens = [...html.matchAll(secRe)]
  for (let i = 0; i < opens.length; i++) {
    const anchor = opens[i][1]
    const start = opens[i].index + opens[i][0].length
    const end = i + 1 < opens.length ? opens[i + 1].index : html.length
    const chunk = html.slice(start, end)
    const m = chunk.match(/<span class="sr-sec-name">([\s\S]*?)<\/span>/)
    if (!m) continue
    out.push({ anchor, name: m[1].trim() })
  }
  return out
}

// PURE: snapshot names ([{anchor,name}]) → { anchor: name }. Throws if a teaching
// anchor appears twice with different names (the genres have unique anchors, so a
// clean snapshot never does; this guards a malformed snapshot).
export function anchorNameMap(entries) {
  const map = {}
  for (const { anchor, name } of entries) {
    if (anchor in map && map[anchor] !== name)
      throw new Error(`anchor "${anchor}" has conflicting names "${map[anchor]}" vs "${name}"`)
    map[anchor] = name
  }
  return map
}

// PURE: add `name` to each card by anchor. Returns { content, added, missing }.
// `missing` = card anchors with no snapshot name (a hard error for the caller).
// Only the `name` field is set; card order and every other field are preserved.
export function applyNames(content, nameByAnchor) {
  const cards = content.cards.map((c) => ({ ...c }))
  const missing = []
  let added = 0
  for (const card of cards) {
    const name = nameByAnchor[card.anchor]
    if (name == null) { missing.push(card.anchor); continue }
    if (card.name !== name) added++
    card.name = name
  }
  return { content: { ...content, cards }, added, missing }
}

async function main() {
  const check = process.argv.includes('--check')
  const root = repoRoot()
  const snapDir = join(root, '.intentmill/tickets/STEMROBIN-21-migrate-content-jsonb/refs/migration/snapshots')
  const backupDir = join(root, '.intentmill/tickets/STEMROBIN-34-restore-titles/refs/content-backup')
  if (!existsSync(snapDir)) throw new Error(`snapshots not found: ${snapDir}`)

  const ids = readdirSync(snapDir).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort()
  const sql = connect()
  let mutated = 0
  const report = []
  try {
    if (!check) mkdirSync(backupDir, { recursive: true })
    for (const id of ids) {
      const html = readFileSync(join(snapDir, `${id}.html`), 'utf8')
      const nameByAnchor = anchorNameMap(extractSectionNames(html))
      const rows = await sql`select content from sr_lessons where id = ${id}`
      if (!rows.length) throw new Error(`${id}: snapshot has no matching sr_lessons row`)
      const content = rows[0].content
      if (!content || !Array.isArray(content.cards)) throw new Error(`${id}: sr_lessons.content has no cards[]`)

      const { content: next, added, missing } = applyNames(content, nameByAnchor)
      if (missing.length) throw new Error(`${id}: card anchors with NO snapshot name: ${JSON.stringify(missing)}`)

      const names = next.cards.map((c) => `${c.anchor}=${c.name}`)
      report.push(`${id}: ${next.cards.length} cards | ${added} name(s) set | ${names.join(', ')}`)

      if (!check) {
        // snapshot the pre-mutation content first (reversible), then write only `name`.
        writeFileSync(join(backupDir, `${id}.json`), JSON.stringify(content, null, 2))
        await sql`update sr_lessons set content = ${sql.json(next)}, updated_at = now() where id = ${id}`
      }
      if (added) mutated++
    }
  } finally {
    await sql.end()
  }

  for (const line of report) console.log(line)
  console.log(`\n${check ? '[--check] dry-run' : 'restore'}: ${ids.length} lessons · ${mutated} needed a name change${check ? ' (nothing written)' : ` · backups → ${backupDir}`}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1) })
}
