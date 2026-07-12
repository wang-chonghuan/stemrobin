#!/usr/bin/env node
// sr-math-lesson cap4 — deterministic persistence into the Azure easy-app Postgres
// (schema stemrobin-schema). Two paths:
//   1) 課文: validate genre-specific section anchors, pre-render a print PDF
//      (playwright-core when available), upsert sr_lessons (html + pdf).
//   2) deck (--questions): validate choice-only item shape and replace
//      sr_questions (with layer/review_of/accept columns).
// Composition rules are check-exercises.mjs's job (run before the gate).
// DB creds from repo-root .env (EASYAPP_DATABASE_URL). Never echoes secrets.
//
// 課文:  node save-lesson.mjs --id math-s2-03 --subject math --stage 2 --order 3 \
//          --genre 概念课 --title "…" --concept "…" --status draft --html <file> \
//          --ledger resources/content/math-ledger/stage-2.json \
//          [--outline resources/content/course-gen-guide-math.md]
// deck:  node save-lesson.mjs --id math-s2-03 --questions <deck.json> \
//          --ledger resources/content/math-ledger/stage-2.json \
//          [--outline resources/content/course-gen-guide-math.md]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1) }

let repoRoot
try { repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim() }
catch { fail('not inside a git repo') }

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
if (!args.id) fail('missing --id')
if (!/^math-s\d+-\d{2}$/.test(args.id)) fail(`--id must look like math-s2-03 (got ${args.id})`)
if (!args.ledger) fail('missing --ledger (the math ledger is the lesson metadata SSOT)')

const scriptDir = dirname(fileURLToPath(import.meta.url))
const idParts = args.id.match(/^math-s(\d+)-(\d{2})$/)
const idStage = Number(idParts[1])
const idOrder = Number(idParts[2])
const existingDeck = args['existing-deck'] === 'true'

function readJson(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch (e) { fail(`${label} JSON parse error: ${e.message}`) }
}

function loadLedgerEntry() {
  const ledgerPath = resolve(process.cwd(), args.ledger)
  if (!existsSync(ledgerPath)) fail(`ledger file not found: ${args.ledger}`)
  const ledger = readJson(ledgerPath, 'ledger')
  const entry = Array.isArray(ledger.lessons) ? ledger.lessons.find((l) => l.id === args.id) : null
  const problems = []
  if (ledger.subject !== 'math') problems.push(`ledger subject must be math (got ${ledger.subject ?? 'missing'})`)
  if (Number(ledger.stage) !== idStage) problems.push(`ledger stage ${ledger.stage ?? 'missing'} does not match id stage ${idStage}`)
  if (!entry) problems.push(`lesson ${args.id} is not in ledger ${args.ledger}`)
  else if (Number(entry.order) !== idOrder) problems.push(`ledger order ${entry.order} does not match id order ${idOrder}`)
  if (problems.length) fail(`Ledger validation failed:\n  - ${problems.join('\n  - ')}`)
  return { ledgerPath, ledger, entry }
}

const ledgerCtx = loadLedgerEntry()

function runOutlineCheck() {
  const outlinePath = args.outline || join(repoRoot, 'resources/content/course-gen-guide-math.md')
  try {
    execFileSync(process.execPath, [
      join(scriptDir, 'check-outline.mjs'),
      outlinePath,
      '--ledger',
      ledgerCtx.ledgerPath,
      '--id',
      args.id,
    ], { stdio: 'inherit' })
  } catch (error) {
    process.exit(typeof error.status === 'number' ? error.status : 1)
  }
}

if (!existingDeck) runOutlineCheck()
else if (!args.questions) fail('--existing-deck is only valid with --questions')

const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2] }
if (!env.EASYAPP_DATABASE_URL) fail('no EASYAPP_DATABASE_URL in .env')
const sql = postgres(env.EASYAPP_DATABASE_URL, { ssl: 'require', max: 3, connection: { search_path: '"stemrobin-schema"' } })

const ANCHORS = {
  概念课: ['motivation', 'model', 'anatomy', 'boundary', 'connections', 'oral'],
  方法课: ['motivation', 'explain', 'examples', 'connections', 'oral'],
  练习课: ['motivation'], // short orientation only — the deck is the substance
}

function checkArgEquals(problems, name, got, expected) {
  if (String(got).trim() !== String(expected).trim()) problems.push(`--${name} "${got}" does not match ledger "${expected}"`)
}

function validateLessonMetadata(entry) {
  const problems = []
  checkArgEquals(problems, 'subject', args.subject, ledgerCtx.ledger.subject)
  if (Number(args.stage) !== Number(ledgerCtx.ledger.stage)) problems.push(`--stage ${args.stage} does not match ledger stage ${ledgerCtx.ledger.stage}`)
  if (Number(args.order) !== Number(entry.order)) problems.push(`--order ${args.order} does not match ledger order ${entry.order}`)
  checkArgEquals(problems, 'title', args.title, entry.title)
  checkArgEquals(problems, 'genre', args.genre, entry.genre)
  if (args.concept && String(args.concept).trim() !== String(entry.core_idea).trim()) {
    problems.push(`--concept does not match ledger core_idea`)
  }
  if (problems.length) fail(`Lesson metadata does not match the ledger:\n  - ${problems.join('\n  - ')}`)
}

function runDeckCompositionCheck(qPath) {
  try {
    execFileSync(process.execPath, [
      join(scriptDir, 'check-exercises.mjs'),
      qPath,
      '--ledger',
      ledgerCtx.ledgerPath,
      '--id',
      args.id,
    ], { stdio: 'inherit' })
  } catch (e) {
    process.exit(typeof e.status === 'number' ? e.status : 1)
  }
}

// ---------------------------------------------------------------------------
// Practice section — GENERATED from the deck (single source of truth) and
// embedded into the lesson html so the learner sees all questions while
// reading, and the printed PDF carries them on their own page with full-width
// rules between items (room to write by pen). Prompts + options ONLY — the
// answer key (answer/correct_index/accept) never enters the html.
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function optionLabel(index) {
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

function renderPractice(items, html) {
  const secCount = (html.match(/<section data-sr-section=/g) || []).length
  const lis = items
    .map((q) => {
      const tags = `<span class="sr-ptype">${esc(q.type)}</span>` +
        (q.layer === '复习' ? `<span class="sr-ptype" style="background:var(--sr-green-tint);color:var(--sr-green-deep)">复习</span>` : '')
      const opts = q.answer_mode === 'choice' && Array.isArray(q.options)
        ? `<div class="sr-p-opts">${q.options.map((o, k) => `<span class="sr-p-opt"><b>${optionLabel(k)}.</b> ${esc(o)}</span>`).join('')}</div>`
        : ''
      return `      <li>${tags} ${esc(q.prompt)}${opts}</li>`
    })
    .join('\n')
  return `
  <section data-sr-section="practice">
    <style>
      /* injected with the deck — screen extras + print layout (self-contained) */
      ol.sr-practice { padding-left:0; list-style:none; counter-reset:p; }
      ol.sr-practice > li { counter-increment:p; position:relative; padding:9px 0 9px 34px; border-top:1px solid var(--sr-line-soft); font-size:14.5px; }
      ol.sr-practice > li:first-child { border-top:0; }
      ol.sr-practice > li::before { content:counter(p); position:absolute; left:0; top:9px; width:22px; height:22px; display:grid; place-items:center; border-radius:6px; background:var(--sr-panel); color:var(--sr-ink-soft); font-family:var(--sr-mono); font-size:11.5px; font-weight:600; }
      .sr-ptype { display:inline-block; margin-right:6px; border-radius:5px; padding:0 6px; background:var(--sr-blue-tint); color:var(--sr-blue-deep); font-size:10.5px; font-weight:700; vertical-align:1px; }
      .sr-p-note { color: var(--sr-ink-dim); font-size: 12.5px; margin: -2px 0 8px; }
      .sr-p-opts { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 7px; }
      .sr-p-opt { font-size: 14px; }
      .sr-p-opt b { font-family: var(--sr-mono); font-weight: 600; color: var(--sr-ink-soft); margin-right: 3px; }
      @media print {
        section[data-sr-section="practice"] { break-before: page; page-break-before: always; }
        ol.sr-practice > li { border-top: 1.4px solid #111; border-bottom: 1.4px solid #111; padding: 16px 0 46px; break-inside: avoid; }
        ol.sr-practice > li::before { top: 16px; }
      }
    </style>
    <div class="sr-sec-label"><span class="sr-sec-num">${secCount + 1}</span><span class="sr-sec-name">练习</span></div>
    <p class="sr-p-note">可以边读边想，也可以打印出来用笔写。做完打开「卡片答题」逐题核对——答案和讲解都在那里。</p>
    <ol class="sr-practice">
${lis}
    </ol>
  </section>`
}

// Remove a previously injected practice section (idempotent re-saves).
function stripPractice(html) {
  return html.replace(/\n?\s*<section data-sr-section="practice">[\s\S]*?<\/section>/g, '')
}

// Render the print PDF for a full lesson html (best effort).
async function renderPdf(html) {
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
      const buf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
      console.log(`✓ pdf rendered (${Math.round(buf.length / 1024)} KB)`)
      return buf
    } finally { await browser.close() }
  } catch (e) {
    console.error(`! PDF not generated (${(e && e.message) || e})`)
    return null
  }
}

async function main() {
  // ===== deck path =====
  if (args.questions) {
    const qPath = resolve(process.cwd(), args.questions)
    if (!existsSync(qPath)) fail(`questions file not found: ${args.questions}`)
    let items
    try { items = JSON.parse(readFileSync(qPath, 'utf8')) } catch (e) { fail(`questions JSON parse error: ${e.message}`) }
    if (!Array.isArray(items) || !items.length) fail('questions JSON must be a non-empty array')
    items.forEach((q, i) => {
      if (!q.prompt || !q.type || !q.answer) fail(`question ${i}: prompt/type/answer required`)
      if (q.answer_mode !== 'choice') fail(`question ${i}: answer_mode must be choice`)
      if (!q.layer) fail(`question ${i}: layer required`)
      if (q.layer === '复习' && !q.review_of) fail(`question ${i}: 复习 needs review_of`)
      if (!Array.isArray(q.options) || q.options.length < 3) fail(`question ${i}: choice needs >=3 options`)
      const normalized = q.options.map((option) => String(option).trim())
      if (normalized.some((option) => !option)) fail(`question ${i}: choice options must be non-empty`)
      if (new Set(normalized).size !== normalized.length) fail(`question ${i}: choice options must be unique`)
      if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length)
        fail(`question ${i}: correct_index out of range`)
      if (q.accept != null) fail(`question ${i}: choice must not carry accept`)
    })
    runDeckCompositionCheck(qPath)
    const rows = await sql`select html from sr_lessons where id = ${args.id}`
    if (!rows.length) fail(`lesson ${args.id} not found — save the 課文 first`)
    if (!rows[0].html) fail(`lesson ${args.id} has no 課文 html — save it first`)
    if (existingDeck) {
      const stored = await sql`
        select ord, prompt, type, layer, review_of, answer
        from sr_questions where lesson_id = ${args.id} order by ord
      `
      const sortedItems = [...items].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
      if (stored.length !== sortedItems.length) fail('--existing-deck requires the same question count')
      for (let i = 0; i < stored.length; i++) {
        const before = stored[i]
        const after = sortedItems[i]
        if (
          before.ord !== after.ord ||
          before.prompt !== after.prompt ||
          before.type !== after.type ||
          (before.layer ?? null) !== (after.layer ?? null) ||
          (before.review_of ?? null) !== (after.review_of ?? null) ||
          before.answer !== after.answer
        ) fail(`--existing-deck may not change question ${i + 1} prompt, order, type, layer, review target, or answer`)
      }
    }

    // Embed the deck-rendered practice section (prompts + options only) into the
    // 課文 so reading shows every question, then re-render the print PDF (the
    // practice starts on its own page with full-width write-in rules).
    const sorted = [...items].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
    const base = stripPractice(rows[0].html)
    const withPractice = base.replace(/<\/article>/, `${renderPractice(sorted, base)}\n\n</article>`)
    if (!withPractice.includes('data-sr-section="practice"')) fail('failed to inject practice section (no </article> in stored html?)')
    const pdfBuf = await renderPdf(withPractice)

    await sql`
      update sr_lessons set html = ${withPractice},
        pdf = coalesce(${pdfBuf ? Buffer.from(pdfBuf) : null}, pdf), updated_at = now()
      where id = ${args.id}
    `
    await sql`delete from sr_questions where lesson_id = ${args.id}`
    let n = 0
    for (let i = 0; i < items.length; i++) {
      const q = items[i]
      await sql`
        insert into sr_questions (lesson_id, ord, type, prompt, answer_mode, options, correct_index, accept, layer, review_of, answer)
        values (${args.id}, ${q.ord ?? i + 1}, ${q.type}, ${q.prompt}, ${q.answer_mode},
                ${q.answer_mode === 'choice' ? sql.json(q.options) : null},
                ${q.answer_mode === 'choice' ? q.correct_index : null},
                null,
                ${q.layer}, ${q.review_of ?? null}, ${q.answer})
      `
      n++
    }
    console.log(`✓ sr_questions replaced for ${args.id}: ${n} items · practice section embedded into 課文`)
    await sql.end()
    return
  }

  // ===== 課文 path =====
  for (const k of ['subject', 'stage', 'order', 'title', 'genre', 'html']) if (!args[k]) fail(`missing --${k}`)
  if (args.subject !== 'math') fail('only --subject math is supported by sr-math-lesson')
  validateLessonMetadata(ledgerCtx.entry)
  const anchors = ANCHORS[args.genre]
  if (!anchors) fail(`--genre must be 概念课|方法课|练习课`)
  const status = args.status || 'draft'
  if (!['draft', 'published'].includes(status)) fail('--status must be draft|published')

  const htmlSrc = resolve(process.cwd(), args.html)
  if (!existsSync(htmlSrc)) fail(`html file not found: ${args.html}`)
  const html = readFileSync(htmlSrc, 'utf8')

  const problems = []
  for (const sec of anchors) if (!html.includes(`data-sr-section="${sec}"`)) problems.push(`missing section anchor: ${sec}`)
  if (html.includes('<section data-sr-section="practice"')) problems.push('課文 must NOT contain a practice section (the deck is the practice)')
  if (!/katex/i.test(html)) problems.push('KaTeX not wired')
  if (!html.includes('--sr-')) problems.push('DESIGN tokens missing')
  if (/\{\{[A-Z_]+\}\}/.test(html)) problems.push('leftover {{PLACEHOLDER}}')
  if (html.length < 1500) problems.push(`html suspiciously short (${html.length} bytes)`)
  if (problems.length) fail(`HTML validation failed:\n  - ${problems.join('\n  - ')}`)

  // --- pre-render print PDF (best effort) ---
  const pdfBuf = await renderPdf(html)

  await sql`
    insert into sr_lessons (id, subject, stage, lesson_order, title, concept, html, pdf, status, updated_at)
    values (${args.id}, ${args.subject}, ${parseInt(args.stage, 10)}, ${parseInt(args.order, 10)},
            ${args.title}, ${ledgerCtx.entry.core_idea || args.concept || ''}, ${html}, ${pdfBuf ? Buffer.from(pdfBuf) : null}, ${status}, now())
    on conflict (id) do update set
      subject=excluded.subject, stage=excluded.stage, lesson_order=excluded.lesson_order,
      title=excluded.title, concept=excluded.concept, html=excluded.html,
      pdf=coalesce(excluded.pdf, sr_lessons.pdf), status=excluded.status, updated_at=now()
  `
  console.log(`✓ sr_lessons upserted: ${args.id} (${args.genre}) status=${status}`)
  // Re-saving the 課文 replaces the html wholesale, dropping any deck-injected
  // practice section — remind the operator to re-run the deck save after it.
  const qn = await sql`select count(*)::int as n from sr_questions where lesson_id = ${args.id}`
  if (qn[0].n > 0) console.log(`! this lesson has ${qn[0].n} questions — re-run the deck save (--questions) to re-embed the practice section + refresh the PDF`)
  await sql.end()
}

main().catch((e) => {
  if (/column .* does not exist/i.test(String(e && e.message))) {
    console.error('✗ sr_questions is missing the new columns (accept/layer/review_of) — apply ssot-schemas/db-schemas/stemrobin.sql')
  } else console.error(e)
  process.exit(1)
})
