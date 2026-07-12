#!/usr/bin/env node
// save-lesson.mjs — deterministic persistence for an sr-lesson math lesson into
// the Azure easy-app Postgres (schema stemrobin-schema). Two paths:
//   1) 課文 save: validate the FIVE-section 課文 HTML (motivation/explain/examples/
//      connections/oral — NO practice; practice moved to a separate cap), pre-render
//      a print PDF, and upsert stemrobin.sr_lessons (html + pdf bytes).
//   2) exercises save (--questions <json>): replace stemrobin.sr_questions for the
//      lesson from a structured questions JSON.
//
// DB creds come from EASYAPP_DATABASE_URL in the repo-root .env (server-only).
// Never echoes secrets.
//
// Usage (課文):
//   node .agents/skills/sr-lesson/scripts/save-lesson.mjs \
//     --id math-s3-03 --subject math --stage 3 --order 3 \
//     --title "等式两边同乘同除" --concept "..." --status draft \
//     --html <courseware.html>
// Usage (exercises):
//   node .agents/skills/sr-lesson/scripts/save-lesson.mjs \
//     --id math-s3-03 --questions <questions.json>
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres from 'postgres'

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1) }

let repoRoot
try {
  repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
} catch { fail('not inside a git repo') }

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ }
}
if (!args.id) fail('missing --id')
if (!/^math-s\d+-\d{2}$/.test(args.id)) fail(`--id must look like math-s3-03 (got ${args.id})`)

// --- DB connection ---
const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
if (!env.EASYAPP_DATABASE_URL) fail('no EASYAPP_DATABASE_URL in .env')
const sql = postgres(env.EASYAPP_DATABASE_URL, {
  ssl: 'require', max: 3, connection: { search_path: '"stemrobin-schema"' },
})

async function main() {
  // ===== exercises path =====
  if (args.questions) {
    const qPath = resolve(process.cwd(), args.questions)
    if (!existsSync(qPath)) fail(`questions file not found: ${args.questions}`)
    let items
    try { items = JSON.parse(readFileSync(qPath, 'utf8')) } catch (e) { fail(`questions JSON parse error: ${e.message}`) }
    if (!Array.isArray(items) || !items.length) fail('questions JSON must be a non-empty array')
    // validate shape
    items.forEach((q, i) => {
      if (!q.prompt || !q.type || !q.answer) fail(`question ${i}: prompt/type/answer required`)
      if (q.answer_mode !== 'choice') fail(`question ${i}: answer_mode must be choice`)
      if (!Array.isArray(q.options) || q.options.length < 3) fail(`question ${i}: choice needs >=3 options`)
      const normalized = q.options.map((option) => String(option).trim())
      if (normalized.some((option) => !option)) fail(`question ${i}: choice options must be non-empty`)
      if (new Set(normalized).size !== normalized.length) fail(`question ${i}: choice options must be unique`)
      if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length)
        fail(`question ${i}: correct_index out of range`)
    })
    const rows = await sql`select 1 from sr_lessons where id = ${args.id}`
    if (!rows.length) fail(`lesson ${args.id} not found — save the 課文 first`)
    await sql`delete from sr_questions where lesson_id = ${args.id}`
    let n = 0
    for (let i = 0; i < items.length; i++) {
      const q = items[i]
      await sql`
        insert into sr_questions (lesson_id, ord, type, prompt, answer_mode, options, correct_index, answer)
        values (${args.id}, ${q.ord ?? i + 1}, ${q.type}, ${q.prompt}, ${q.answer_mode},
                ${q.answer_mode === 'choice' ? sql.json(q.options) : null},
                ${q.answer_mode === 'choice' ? q.correct_index : null}, ${q.answer})
      `
      n++
    }
    console.log(`✓ sr_questions replaced for ${args.id}: ${n} items`)
    await sql.end()
    return
  }

  // ===== 課文 path =====
  for (const k of ['subject', 'stage', 'order', 'title', 'html']) if (!args[k]) fail(`missing --${k}`)
  if (args.subject !== 'math') fail('only --subject math is supported this stage')
  const status = args.status || 'draft'
  if (!['draft', 'published'].includes(status)) fail('--status must be draft|published')

  const htmlSrc = resolve(process.cwd(), args.html)
  if (!existsSync(htmlSrc)) fail(`html file not found: ${args.html}`)
  const html = readFileSync(htmlSrc, 'utf8')

  const problems = []
  // 課文 = five sections; practice is authored by the separate exercises cap.
  for (const sec of ['motivation', 'explain', 'examples', 'connections', 'oral']) {
    if (!html.includes(`data-sr-section="${sec}"`)) problems.push(`missing section anchor: ${sec}`)
  }
  if (html.includes('<section data-sr-section="practice"')) problems.push('課文 must NOT contain a practice section (exercises are a separate cap)')
  if (!/katex/i.test(html)) problems.push('KaTeX not wired')
  if (!html.includes('--sr-')) problems.push('DESIGN tokens missing')
  if (/\{\{[A-Z_]+\}\}/.test(html)) problems.push('leftover {{PLACEHOLDER}}')
  if (html.length < 1500) problems.push(`html suspiciously short (${html.length} bytes)`)
  if (problems.length) fail(`HTML validation failed:\n  - ${problems.join('\n  - ')}`)

  // --- pre-render print PDF ---
  let pdfBuf = null
  try {
    const { chromium } = await import('playwright-core')
    let browser
    try { browser = await chromium.launch() } catch { browser = await chromium.launch({ channel: 'chrome' }) }
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.katex && document.querySelectorAll('.katex').length > 0, null, { timeout: 6000 }).catch(() => {})
      await page.evaluate(() => document.fonts.ready.then(() => true))
      await page.waitForTimeout(400)
      await page.emulateMedia({ media: 'print' })
      pdfBuf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
      console.log(`✓ pdf rendered (${Math.round(pdfBuf.length / 1024)} KB)`)
    } finally { await browser.close() }
  } catch (e) {
    console.error(`! PDF not generated (${(e && e.message) || e}); saving 課文 without PDF`)
  }

  await sql`
    insert into sr_lessons (id, subject, stage, lesson_order, title, concept, html, pdf, status, updated_at)
    values (${args.id}, ${args.subject}, ${parseInt(args.stage, 10)}, ${parseInt(args.order, 10)},
            ${args.title}, ${args.concept || ''}, ${html}, ${pdfBuf ? Buffer.from(pdfBuf) : null}, ${status}, now())
    on conflict (id) do update set
      subject=excluded.subject, stage=excluded.stage, lesson_order=excluded.lesson_order,
      title=excluded.title, concept=excluded.concept, html=excluded.html,
      pdf=coalesce(excluded.pdf, sr_lessons.pdf), status=excluded.status, updated_at=now()
  `
  console.log(`✓ sr_lessons upserted: ${args.id} status=${status}`)
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
