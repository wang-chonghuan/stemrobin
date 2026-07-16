#!/usr/bin/env node
// sr-math-lesson — deterministic, idempotent RE-RENDER of the derived
// `sr_lessons.html` (+ best-effort `pdf`) caches FROM the JSONB SSOT already in
// the DB (content + exercises + zh overlay + the stage ledger). STEMROBIN-40.
//
// Why: html/pdf are DERIVED caches of the JSONB. After STEMROBIN-34 restored
// each card's section display name (中文名) into `sr_lessons.content`, the stored
// html was left STALE — it still showed the pre-restore generic labels. This
// script regenerates every lesson's html (and pdf) through the ONE canonical
// render path (render-lesson.mjs), the same renderer save-lesson.mjs uses, so
// the stored cache shows `sr-sec-num`(序号) + `sr-sec-name`(中文名) and the styled
// practice (练习) section — matching the PDF look.
//
// It NEVER touches the content/exercises JSONB, the zh overlay, or `sr_users`.
// It only rewrites the derived html/pdf columns. Meta (title/genre/theme/concept)
// is taken from the DB stage ledger (sr_content_ledger), exactly as
// save-lesson.mjs builds it, so a re-render matches a fresh save byte-for-byte.
//
// Answer-key secrecy (G5): render-lesson.mjs structurally never reads item.key,
// so the regenerated practice section carries prompts + options only — never
// correct_index / accept / answer.
//
// Deterministic + idempotent: same JSONB → same html every run. Reversible: the
// current html of each lesson is snapshotted BEFORE mutation to
//   .intentmill/tickets/STEMROBIN-40-rerender-html/refs/html-snapshot/<id>.html
//
// Usage (from repo root or anywhere in the repo):
//   node .agents/skills/sr-math-lesson/scripts/rerender-lessons.mjs [--check] [--no-pdf] [--id math-s3-07]
//   --check  : dry-run — render + diff against stored, report, write NOTHING.
//   --no-pdf : re-render html only (keep the existing pdf via coalesce).
//   --id X   : limit to a single lesson id (default: all math lessons).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, repoRoot } from './db.mjs'
import { renderLessonHtml, renderPdf } from './render-lesson.mjs'

const argv = process.argv.slice(2)
const check = argv.includes('--check')
const noPdf = argv.includes('--no-pdf')
const idFlag = (() => { const i = argv.indexOf('--id'); return i >= 0 ? argv[i + 1] : null })()

async function main() {
  const root = repoRoot()
  const snapDir = join(root, '.intentmill/tickets/STEMROBIN-40-rerender-html/refs/html-snapshot')
  const sql = connect()
  let changed = 0
  let pdfCount = 0
  const report = []
  try {
    if (!check) mkdirSync(snapDir, { recursive: true })

    // Cache every stage ledger once (SSOT for title/genre/theme/concept).
    const ledgerRows = await sql`select subject, stage, ledger from sr_content_ledger`
    const ledgerBy = new Map(ledgerRows.map((r) => [`${r.subject}|${r.stage}`, r.ledger]))

    const where = idFlag ? sql`where id = ${idFlag}` : sql`where subject = 'math'`
    const lessons = await sql`
      select id, subject, stage, lesson_order, content, exercises, html
      from sr_lessons ${where} order by subject, stage, lesson_order`
    if (!lessons.length) throw new Error(idFlag ? `no lesson row for id=${idFlag}` : 'no math lessons found')

    for (const row of lessons) {
      const ledger = ledgerBy.get(`${row.subject}|${row.stage}`)
      if (!ledger) throw new Error(`${row.id}: no ledger in sr_content_ledger for ${row.subject} stage ${row.stage}`)
      const entry = Array.isArray(ledger.lessons) ? ledger.lessons.find((l) => l.id === row.id) : null
      if (!entry) throw new Error(`${row.id}: not present in the ${row.subject} stage-${row.stage} ledger`)

      const [ov] = await sql`select overlay from sr_lesson_i18n where lesson_id = ${row.id} and locale = 'zh'`
      if (!ov || !ov.overlay) throw new Error(`${row.id}: no zh overlay in sr_lesson_i18n`)

      // meta built exactly as save-lesson.mjs does (ledger is the SSOT here).
      const meta = {
        id: row.id, subject: row.subject, stage: row.stage, order: row.lesson_order,
        title: entry.title, genre: entry.genre, theme: ledger.theme, concept: entry.core_idea || '',
      }
      const html = renderLessonHtml({ meta, content: row.content, exercises: row.exercises, overlay: ov.overlay })
      const willChange = html !== row.html

      let pdfNote = 'kept'
      if (check) {
        report.push(`${row.id}: html ${willChange ? 'WOULD CHANGE' : 'unchanged'} (${(row.html || '').length}B → ${html.length}B)`) // dry-run
      } else {
        // Snapshot current html BEFORE mutating (reversible).
        writeFileSync(join(snapDir, `${row.id}.html`), row.html || '')
        let pdfBuf = null
        if (!noPdf) { pdfBuf = await renderPdf(html); if (pdfBuf) { pdfNote = `${Math.round(pdfBuf.length / 1024)}KB`; pdfCount++ } }
        await sql`
          update sr_lessons
          set html = ${html}, pdf = coalesce(${pdfBuf ? Buffer.from(pdfBuf) : null}, pdf), updated_at = now()
          where id = ${row.id}`
        report.push(`${row.id}: html ${willChange ? 'updated' : 'rewritten (identical)'} ${html.length}B · pdf ${noPdf ? 'skipped' : pdfNote}`)
      }
      if (willChange) changed++
    }
  } finally {
    await sql.end()
  }

  for (const line of report) console.log(line)
  console.log(
    `\n${check ? '[--check] dry-run' : 're-render'}: ${report.length} lessons · ` +
    `${changed} html changed${check ? ' (nothing written)' : ` · ${noPdf ? 'pdf skipped' : pdfCount + ' pdf rendered'} · snapshots → ${snapDir}`}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1) })
}
