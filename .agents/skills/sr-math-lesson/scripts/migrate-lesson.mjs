#!/usr/bin/env node
// sr-math-lesson — STEMROBIN-21: migrate ONE existing lesson into the JSONB SSOT.
// Reuses migrate-lib (structural extraction), render-lesson.mjs (derived HTML/PDF),
// check-content.validateContent (hard structural gate) + check-exercises
// .validateExercises (informational). Does NOT route through save-lesson.mjs
// (its human-outline gate rejects stage-2, STEMROBIN-17). Idempotent upsert.
//
// Modes:
//   --digest   : write a per-substantial-card prose digest for read-check authoring; no DB write.
//   (default)  : snapshot original html + sr_questions, build content/exercises/overlay,
//                merge authored read-checks (refs/migration/readchecks/<id>.json), validate,
//                render, upsert sr_lessons + sr_lesson_i18n(zh), write prose diff.
//
// Usage (from repo root):
//   node .agents/skills/sr-math-lesson/scripts/migrate-lesson.mjs --id math-s2-03 [--digest]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, repoRoot } from './db.mjs'
import { htmlToCards, deckToExercises, mergeReadChecks, substantialAnchors, extractSectionInner, splitSectionChildren } from './migrate-lib.mjs'
import { validateContent } from './check-content.mjs'
import { validateExercises } from './check-exercises.mjs'
import { renderLessonHtml, renderPdf } from './render-lesson.mjs'

function fail(m) { console.error(`✗ ${m}`); process.exit(1) }
const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const next = argv[i + 1]; if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = next; i++ } } }
const id = args.id
if (!id || !/^math-s\d+-\d{2}$/.test(id)) fail('missing/invalid --id (e.g. math-s2-03)')
const stage = Number(id.match(/^math-s(\d+)-/)[1])

const MIG = join(repoRoot(), '.intentmill/tickets/STEMROBIN-21-migrate-content-jsonb/refs/migration')
for (const d of ['snapshots', 'diffs', 'digests', 'readchecks']) mkdirSync(join(MIG, d), { recursive: true })

// tags → plain text (normalized whitespace), for prose-fidelity diffing.
const plain = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

const sql = await connect()
try {
  const lrows = await sql`select id, subject, stage, lesson_order, title, concept, html from sr_lessons where id = ${id}`
  if (!lrows.length) fail(`lesson ${id} not found`)
  const lesson = lrows[0]
  const ledRows = await sql`select ledger from sr_content_ledger where subject='math' and stage=${stage}`
  if (!ledRows.length) fail(`no sr_content_ledger row for stage ${stage} — run save-ledger.mjs first`)
  const entry = ledRows[0].ledger.lessons.find((l) => l.id === id)
  if (!entry) fail(`${id} not in stage ${stage} ledger`)
  const genre = entry.genre

  // IDEMPOTENCY: always parse the PRISTINE original html. The migration
  // overwrites sr_lessons.html with re-rendered html, so on a re-run the DB row
  // is our own output — parsing it would re-absorb the injected practice/
  // read-check projections. The first run snapshots the true original; every
  // later run reads the source from that snapshot instead of the mutated row.
  const snapPath = join(MIG, 'snapshots', `${id}.html`)
  const sourceHtml = existsSync(snapPath) ? readFileSync(snapPath, 'utf8') : lesson.html
  if (!existsSync(snapPath) && !args.digest) writeFileSync(snapPath, lesson.html)

  // structural extraction (throws on anchor mismatch / empty section)
  const { cards, overlay } = htmlToCards({ html: sourceHtml, genre, id })
  const qrows = await sql`select ord, type, prompt, answer_mode, options, correct_index, accept, layer, review_of, answer from sr_questions where lesson_id = ${id} order by ord`
  const { exercises, overlay: exOverlay } = deckToExercises({ rows: qrows, id })
  Object.assign(overlay, exOverlay)

  if (args.digest) {
    const subs = substantialAnchors(genre)
    const body = sourceHtml.slice(sourceHtml.indexOf('<body'))
    let md = `# read-check digest · ${id} · ${genre} · ${entry.title}\n\n> Author >=2 read-checks per card below. Each must test ONLY whether the learner read THIS card (answer locatable in the card); mode choice (4 options, one right, 3 plausible-misconception) or input. Write to refs/migration/readchecks/${id}.json as { "<anchor>": [ {mode, prompt, options?, correct_index?, accept?}, ... ] }.\n\n`
    for (const anchor of subs) {
      const inner = extractSectionInner(body, anchor)
      const text = splitSectionChildren(inner).map((c) => plain(c.html)).filter(Boolean).join('\n\n')
      md += `## card ${anchor}\n\n${text}\n\n---\n\n`
    }
    writeFileSync(join(MIG, 'digests', `${id}.md`), md)
    console.log(`· digest written for ${id} (${subs.length} substantial cards)`)
    await sql.end(); process.exit(0)
  }

  // snapshot the deck (questions are never mutated; safe to refresh). The html
  // snapshot (the pristine original) was captured above before any mutation.
  writeFileSync(join(MIG, 'snapshots', `${id}.questions.json`), JSON.stringify(qrows, null, 2))

  // merge authored read-checks
  const rcPath = join(MIG, 'readchecks', `${id}.json`)
  const subs = substantialAnchors(genre)
  if (subs.length) {
    if (!existsSync(rcPath)) fail(`${id}: missing authored read-checks ${rcPath} (run --digest, author, then rerun)`)
    const byAnchor = JSON.parse(readFileSync(rcPath, 'utf8'))
    mergeReadChecks({ cards, overlay, byAnchor })
    for (const anchor of subs) {
      const card = cards.find((c) => c.anchor === anchor)
      if (!card || card.read_check.length < 2) fail(`${id}: substantial card "${anchor}" needs >=2 read-checks (got ${card ? card.read_check.length : 0})`)
    }
  }

  // hard structural gate
  const cProblems = validateContent({ content: { cards }, overlay, genre, id })
  if (cProblems.length) fail(`${id} content validation failed:\n  - ${cProblems.join('\n  - ')}`)
  // informational deck composition check (faithful move, not re-authoring)
  const { problems: eProblems } = validateExercises({ exercises, overlay, ledger: ledRows[0].ledger, id })
  if (eProblems.length) console.log(`· [info] ${id} validateExercises notes (non-blocking):\n    - ${eProblems.join('\n    - ')}`)

  // prose-fidelity diff: PRISTINE-original teaching prose vs migrated overlay prose
  const origProse = []
  const body = sourceHtml.slice(sourceHtml.indexOf('<body'))
  for (const c of cards) {
    const inner = extractSectionInner(body, c.anchor)
    for (const child of splitSectionChildren(inner)) {
      if (child.tag === 'figure') { const cap = child.html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/); if (cap) origProse.push(plain(cap[1])) }
      else origProse.push(plain(child.html))
    }
  }
  const migProse = []
  for (const c of cards) for (const n of c.body) {
    if (n.kind === 'prose') migProse.push(plain(overlay[n.id].t))
    else if (n.kind === 'svg' && n.caption_id) migProse.push(plain(overlay[n.caption_id].t))
  }
  const identical = origProse.join('\n') === migProse.join('\n')
  const diffPath = join(MIG, 'diffs', `${id}.prose.diff`)
  if (identical) writeFileSync(diffPath, `IDENTICAL — teaching prose byte-equal between original HTML and migrated JSONB overlay (${migProse.length} blocks).\n`)
  else {
    const a = join(MIG, `.${id}.orig.txt`), b = join(MIG, `.${id}.mig.txt`)
    writeFileSync(a, origProse.join('\n') + '\n'); writeFileSync(b, migProse.join('\n') + '\n')
    let d = ''
    try { execFileSync('diff', ['-u', a, b], { encoding: 'utf8' }) } catch (e) { d = e.stdout || '' }
    writeFileSync(diffPath, d || '(diff produced no output but strings differ)\n')
  }

  // render derived HTML + best-effort PDF FROM the JSONB
  const meta = { id, subject: 'math', stage, order: lesson.lesson_order, title: entry.title, genre, theme: ledRows[0].ledger.theme, concept: entry.core_idea || lesson.concept || '' }
  const html = renderLessonHtml({ meta, content: { cards }, exercises, overlay })
  const pdfBuf = await renderPdf(html)

  // idempotent upsert: JSONB SSOT + derived caches + zh overlay. sr_users/sr_questions untouched.
  await sql`
    update sr_lessons set content=${sql.json({ cards })}, exercises=${sql.json(exercises)}, html=${html},
      pdf=coalesce(${pdfBuf ? Buffer.from(pdfBuf) : null}, sr_lessons.pdf), updated_at=now()
    where id=${id}`
  await sql`
    insert into sr_lesson_i18n (lesson_id, locale, overlay, updated_at)
    values (${id}, 'zh', ${sql.json(overlay)}, now())
    on conflict (lesson_id, locale) do update set overlay=excluded.overlay, updated_at=now()`

  const rc = cards.reduce((n, c) => n + c.read_check.length, 0)
  console.log(`✓ ${id} (${genre}) migrated: ${cards.length} cards / ${rc} read-check · ${exercises.items.length} exercises · overlay ${Object.keys(overlay).length} nodes · html ${html.length}B · pdf ${pdfBuf ? Math.round(pdfBuf.length / 1024) + 'KB' : 'none'} · prose ${identical ? 'IDENTICAL' : 'DIFF!'}`)
} finally {
  await sql.end()
}
