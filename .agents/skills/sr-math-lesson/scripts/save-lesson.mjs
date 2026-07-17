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
//   → upsert sr_lessons(content, exercises, html, pdf) + sr_lesson_i18n(zh)
//   → derive+upsert the relational sr_questions deck the app's card-quiz reads
//     (a zh projection of the JSONB deck: prompt/options from the overlay, the
//     KEY + post-answer `answer` reveal from the neutral base; KEY never in html).
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

  // Every deck item must carry its post-answer reveal: sr_questions.answer is
  // NOT NULL and the app reveals it after answering (the deck is projected to
  // the relational sr_questions the card-quiz reads). Fail fast, before any DB write.
  for (const it of Array.isArray(exercises.items) ? exercises.items : []) {
    if (typeof it.key?.answer !== 'string' || !it.key.answer.trim()) {
      fail(`exercise ${it.id} (ord ${it.ord}) is missing key.answer (the post-answer reveal explanation)`)
    }
  }

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

  // --- derive the relational sr_questions deck (the app serves the zh card-quiz
  //     from sr_questions; it is a DERIVED zh projection, like html/pdf). Prompt/
  //     option TEXT come from the zh overlay; the KEY (correct_index/accept) and
  //     the post-answer `answer` reveal come from the neutral base — they never
  //     enter the overlay or the learner-visible html. Upsert by (lesson_id, ord)
  //     so a re-save preserves question ids (and the learner sr_answer_events that
  //     FK them), then drop any stale tail beyond the new deck.
  const ovText = (nid, what) => {
    const t = overlay[nid]?.t
    if (typeof t !== 'string' || !t.trim()) fail(`overlay missing text for ${what} (${nid})`)
    return t
  }
  const items = Array.isArray(exercises.items) ? exercises.items : []
  for (const it of items) {
    const mode = it.mode
    const options = mode === 'choice' ? (it.options || []).map((oid) => ovText(oid, 'exercise option')) : null
    await sql`
      insert into sr_questions (lesson_id, ord, type, prompt, answer_mode, options, correct_index, accept, layer, review_of, answer)
      values (${args.id}, ${it.ord}, ${it.type}, ${ovText(it.id, 'exercise prompt')}, ${mode},
              ${options ? sql.json(options) : null}, ${mode === 'choice' ? it.key.correct_index : null},
              ${mode === 'input' && it.key.accept ? sql.json(it.key.accept) : null},
              ${it.layer ?? null}, ${it.review_of ?? null}, ${it.key.answer})
      on conflict (lesson_id, ord) do update set
        type=excluded.type, prompt=excluded.prompt, answer_mode=excluded.answer_mode,
        options=excluded.options, correct_index=excluded.correct_index, accept=excluded.accept,
        layer=excluded.layer, review_of=excluded.review_of, answer=excluded.answer
    `
  }
  const maxOrd = items.reduce((m, it) => Math.max(m, Number(it.ord) || 0), 0)
  await sql`delete from sr_questions where lesson_id = ${args.id} and ord > ${maxOrd}`

  const cards = content.cards.length
  const rc = content.cards.reduce((n, c) => n + (Array.isArray(c.read_check) ? c.read_check.length : 0), 0)
  console.log(`✓ ${args.id} (${entry.genre}) saved JSONB-first: content ${cards} cards / ${rc} read-check · exercises ${exercises.items.length} items → sr_questions ${items.length} · zh overlay ${Object.keys(overlay).length} nodes · html ${html.length}B · pdf ${pdfBuf ? Math.round(pdfBuf.length / 1024) + 'KB' : 'none'} · status=${status}`)
} finally {
  await sql.end()
}
