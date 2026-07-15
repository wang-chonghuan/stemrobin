#!/usr/bin/env node
// sr-math-lesson (JSONB-first) — STEMROBIN-23: produce the `en` locale overlay for
// ONE lesson from its `zh` source overlay, following the produce → independent-review
// → deterministic-save discipline. Only PROSE is translated; formulas ($…$/$$…$$),
// inline <svg>, markup and numeric literals inherit byte-for-byte from the source.
// The overlay is prose-only and never carries an answer KEY (that lives in the
// neutral base sr_lessons.content/exercises). Writes ONLY sr_lesson_i18n(locale='en').
//
// Modes:
//   --id <id> --emit : read the zh overlay from the DB, write a translation
//                      worksheet refs/translation/src/<id>.json = { node_id: zh }.
//                      The author (agent / subagent) then writes the en strings to
//                      refs/translation/en/<id>.json = { node_id: en }. No DB write.
//   --id <id>        : read the zh overlay + the authored refs/translation/en/<id>.json,
//                      run the check-i18n GATE (hard-fail on any problem), build the
//                      en overlay { node_id: { t, src_rev: <zh src_rev> } } and
//                      idempotently upsert sr_lesson_i18n(lesson_id,'en').
//   --id <id> --dry  : same as save mode but run the GATE ONLY — no DB write. For
//                      authors/subagents to self-check their en file before persisting.
//
// Usage (from repo root):
//   node .agents/skills/sr-math-lesson/scripts/translate-lesson.mjs --id math-s2-01 --emit
//   node .agents/skills/sr-math-lesson/scripts/translate-lesson.mjs --id math-s2-01
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, repoRoot } from './db.mjs'
import { validateI18n } from './check-i18n.mjs'

function fail(m) { console.error(`✗ ${m}`); process.exit(1) }
const argv = process.argv.slice(2)
const args = {}
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const next = argv[i + 1]; if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = next; i++ } } }
const id = args.id
if (!id || !/^math-s\d+-\d{2}$/.test(id)) fail('missing/invalid --id (e.g. math-s2-01)')

const TRANS = join(repoRoot(), '.intentmill/tickets/STEMROBIN-23-en-translation/refs/translation')
for (const d of ['src', 'en']) mkdirSync(join(TRANS, d), { recursive: true })

const sql = await connect()
try {
  const rows = await sql`select overlay from sr_lesson_i18n where lesson_id = ${id} and locale = 'zh'`
  if (!rows.length) fail(`no zh source overlay for ${id} (run migrate-lesson.mjs first)`)
  const zh = rows[0].overlay

  if (args.emit) {
    const worksheet = {}
    for (const [nid, entry] of Object.entries(zh)) worksheet[nid] = entry.t
    const outPath = join(TRANS, 'src', `${id}.json`)
    writeFileSync(outPath, JSON.stringify(worksheet, null, 2) + '\n')
    console.log(`· emitted worksheet ${outPath} (${Object.keys(worksheet).length} nodes) — author en to refs/translation/en/${id}.json`)
    await sql.end(); process.exit(0)
  }

  // save mode: load the authored en strings
  const enPath = join(TRANS, 'en', `${id}.json`)
  if (!existsSync(enPath)) fail(`${id}: missing authored en translations ${enPath} (run --emit, author, then rerun)`)
  let authored
  try { authored = JSON.parse(readFileSync(enPath, 'utf8')) } catch (e) { fail(`${id}: en JSON parse: ${e.message}`) }

  // build the candidate en overlay: prose-only, src_rev inherited from the zh source entry.
  const en = {}
  for (const [nid, enText] of Object.entries(authored)) {
    if (typeof enText !== 'string') fail(`${id}: en["${nid}"] must be a string`)
    const src = zh[nid]
    en[nid] = { t: enText, src_rev: src && Number.isInteger(src.src_rev) ? src.src_rev : 1 }
  }

  // HARD GATE — refuse to persist on any problem (coverage / formulas / SVG / markup / KEY / CJK).
  const problems = validateI18n({ zh, en, id })
  if (problems.length) fail(`${id} i18n gate failed (NOT persisted):\n  - ${problems.join('\n  - ')}`)

  if (args.dry) {
    console.log(`✓ ${id} en gate PASS (dry — not persisted): ${Object.keys(en).length} nodes · coverage==zh, formulas/SVG/markup byte-identical, KEY-free, no CJK residue`)
    await sql.end(); process.exit(0)
  }

  // idempotent, additive-only upsert: ONLY sr_lesson_i18n(locale='en'). zh/base/sr_users untouched.
  await sql`
    insert into sr_lesson_i18n (lesson_id, locale, overlay, updated_at)
    values (${id}, 'en', ${sql.json(en)}, now())
    on conflict (lesson_id, locale) do update set overlay = excluded.overlay, updated_at = now()`

  console.log(`✓ ${id} en overlay saved: ${Object.keys(en).length} nodes · gate PASS (coverage==zh, formulas/SVG/markup byte-identical, KEY-free, no CJK residue)`)
} finally {
  await sql.end()
}
