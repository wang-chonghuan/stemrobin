#!/usr/bin/env node
// sr-math-lesson cap4 (JSONB-first) — deterministic persistence of ONE lesson's
// content into the DB JSONB SSOT (schema stemrobin-schema). The neutral card-tree
// `content` and exercise-deck `exercises` are the authority; the `zh` prose
// overlay is the source-locale text; `sr_lessons.html`/`pdf` are DERIVED caches
// rendered FROM that JSONB. The per-stage ledger is read from sr_content_ledger
// (the DB), never from a local file (G7).
//
// Flow: read ledger row from sr_content_ledger (by subject+stage parsed from id)
//   → validate content+overlay (anchors, num, read-check, KEY-free overlay)
//   → validate exercises+overlay (shape + composition + review_of closure)
//   → [real stages] human-outline fidelity check; [--sample] skip it
//   → render HTML (+ best-effort PDF) from the JSONB
//   → upsert sr_lessons(content, exercises, html, pdf) + sr_lesson_i18n(zh).
// Never hand-writes rows; idempotent (stable node ids, on-conflict upsert).
//
// Usage (from repo root):
//   node .agents/skills/sr-math-lesson/scripts/save-lesson.mjs --id math-s2-03 \
//     --content <c.json> --exercises <e.json> --overlay <o.json> [--status draft] [--sample]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { connect, repoRoot } from './db.mjs'
import { validateContent } from './check-content.mjs'
import { validateExercises } from './check-exercises.mjs'
import { renderLessonHtml, renderPdf } from './render-lesson.mjs'

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1) }

const scriptDir = dirname(fileURLToPath(import.meta.url))
const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const next = argv[i + 1]; if (next === undefined || next.startsWith('--')) { args[a.slice(2)] = true } else { args[a.slice(2)] = next; i++ } } }
if (!args.id) fail('missing --id')
const idm = String(args.id).match(/^math-s(\d+)-(\d{2})$/)
if (!idm) fail(`--id must look like math-s2-03 (got ${args.id})`)
const subject = 'math'
const stage = Number(idm[1])
const order = Number(idm[2])
for (const k of ['content', 'exercises', 'overlay']) if (!args[k]) fail(`missing --${k} <file>`)
const status = args.status && args.status !== true ? args.status : 'draft'
if (!['draft', 'published'].includes(status)) fail('--status must be draft|published')
const isSample = args.sample === true

function readJson(p, what) {
  const fp = resolve(process.cwd(), p)
  if (!existsSync(fp)) fail(`${what} not found: ${p}`)
  try { return JSON.parse(readFileSync(fp, 'utf8')) } catch (e) { fail(`${what} JSON parse error: ${e.message}`) }
}

const content = readJson(args.content, 'content')
const exercises = readJson(args.exercises, 'exercises')
const overlay = readJson(args.overlay, 'overlay')

const sql = await connect()
try {
  // --- ledger from the DB (G7) ---
  const rows = await sql`select ledger from sr_content_ledger where subject = ${subject} and stage = ${stage}`
  if (!rows.length) fail(`no ledger in sr_content_ledger for subject=${subject} stage=${stage} — run save-ledger.mjs first`)
  const ledger = rows[0].ledger
  const entry = Array.isArray(ledger.lessons) ? ledger.lessons.find((l) => l.id === args.id) : null
  if (!entry) fail(`lesson ${args.id} is not in the DB ledger (subject=${subject} stage=${stage})`)
  if (Number(entry.order) !== order) fail(`ledger order ${entry.order} does not match id order ${order}`)

  // --- deterministic validation (shape is the enforcement point) ---
  const cProblems = validateContent({ content, overlay, genre: entry.genre, id: args.id })
  if (cProblems.length) fail(`content validation failed:\n  - ${cProblems.join('\n  - ')}`)
  const { problems: eProblems } = validateExercises({ exercises, overlay, ledger, id: args.id })
  if (eProblems.length) fail(`exercises validation failed:\n  - ${eProblems.join('\n  - ')}`)

  // --- human-outline fidelity: real stages only (a disposable sample maps to no guide entry) ---
  if (!isSample) {
    const tmp = mkdtempSync(join(tmpdir(), 'srml-'))
    const ledgerTmp = join(tmp, `stage-${stage}.json`)
    writeFileSync(ledgerTmp, JSON.stringify(ledger))
    const outlinePath = args.outline && args.outline !== true ? resolve(process.cwd(), args.outline) : join(repoRoot(), 'resources/content/course-gen-guide-math.md')
    try {
      execFileSync(process.execPath, [join(scriptDir, 'check-outline.mjs'), outlinePath, '--ledger', ledgerTmp, '--id', args.id], { stdio: 'inherit' })
    } catch (e) { await sql.end(); process.exit(typeof e.status === 'number' ? e.status : 1) }
  } else {
    console.log('· --sample: skipping human-outline fidelity check (disposable sample maps to no course-guide entry)')
  }

  // --- render HTML + best-effort PDF FROM the JSONB ---
  const meta = { id: args.id, subject, stage, order, title: entry.title, genre: entry.genre, theme: ledger.theme, concept: entry.core_idea || '' }
  const html = renderLessonHtml({ meta, content, exercises, overlay })
  const pdfBuf = await renderPdf(html)

  // --- deterministic upsert: JSONB SSOT + derived caches + zh overlay ---
  await sql`
    insert into sr_lessons (id, subject, stage, lesson_order, title, concept, html, pdf, content, exercises, status, updated_at)
    values (${args.id}, ${subject}, ${stage}, ${order}, ${entry.title}, ${entry.core_idea || ''},
            ${html}, ${pdfBuf ? Buffer.from(pdfBuf) : null}, ${sql.json(content)}, ${sql.json(exercises)}, ${status}, now())
    on conflict (id) do update set
      subject=excluded.subject, stage=excluded.stage, lesson_order=excluded.lesson_order,
      title=excluded.title, concept=excluded.concept, html=excluded.html,
      pdf=coalesce(excluded.pdf, sr_lessons.pdf), content=excluded.content,
      exercises=excluded.exercises, status=excluded.status, updated_at=now()
  `
  await sql`
    insert into sr_lesson_i18n (lesson_id, locale, overlay, updated_at)
    values (${args.id}, 'zh', ${sql.json(overlay)}, now())
    on conflict (lesson_id, locale) do update set overlay=excluded.overlay, updated_at=now()
  `
  const cards = content.cards.length
  const rc = content.cards.reduce((n, c) => n + (Array.isArray(c.read_check) ? c.read_check.length : 0), 0)
  console.log(`✓ ${args.id} (${entry.genre}) saved JSONB-first: content ${cards} cards / ${rc} read-check · exercises ${exercises.items.length} items · zh overlay ${Object.keys(overlay).length} nodes · html ${html.length}B · pdf ${pdfBuf ? Math.round(pdfBuf.length / 1024) + 'KB' : 'none'} · status=${status}`)
} finally {
  await sql.end()
}
