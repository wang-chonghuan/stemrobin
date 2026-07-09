#!/usr/bin/env node
// sr-story cap5 — deterministic persistence for a 名人传记 chapter (Markdown) +
// questions into the Azure easy-app Postgres (schema stemrobin-schema): upsert
// sr_stories + sr_story_chapters (md + staged/section structure + print PDF), and
// replace sr_story_questions for the chapter. Validates the Markdown shape, 正文
// length, the numbered-节 structure, and GLOBAL section-number continuity (the gate
// judges meaning). Never echoes secrets.
//
// Structure (batch 0002): each chapter is divided into numbered 节 written as H2
// headings `## <global-num> <节标题>`, where <global-num> is CONTINUOUS across the
// whole biography — chapter N's first 节 = chapter N-1's last 节 + 1. Chapters group
// into a named 阶段 via --stage/--stage-ord. Each chapter is pre-rendered to a print
// PDF (like sr_lessons.pdf) so a reader can print it, mirroring the math lessons.
//
// Usage (from repo root):
//   node .agents/skills/sr-story/scripts/save-story.mjs \
//     --story ford --title "亨利·福特" --person "亨利·福特（Henry Ford）" \
//     --era "1863–1947" --source-url "https://www.gutenberg.org/ebooks/7213" \
//     --chapter ford-c01 --ord 1 --chapter-title "少年与那台会自己走的机器" \
//     --stage "少年与机械" --stage-ord 1 --status draft \
//     --md <scratch>/ford-c01.md --questions <scratch>/ford-c01.questions.json
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
import { marked } from 'marked'
import { countHanzi, MIN_HANZI } from './wordcount.mjs'

function fail(m) { console.error(`✗ ${m}`); process.exit(1) }

let repoRoot
try { repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim() }
catch { fail('not inside a git repo') }

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
for (const k of ['story', 'title', 'person', 'source-url', 'chapter', 'ord', 'chapter-title', 'md', 'questions'])
  if (!args[k]) fail(`missing --${k}`)
const status = args.status || 'draft'
if (!['draft', 'published'].includes(status)) fail('--status must be draft|published')
if (!/^[a-z0-9-]+$/.test(args.story)) fail(`--story must be a slug (got ${args.story})`)
if (!new RegExp(`^${args.story}-c\\d{2}$`).test(args.chapter)) fail(`--chapter must look like ${args.story}-c01`)
const ord = parseInt(args.ord, 10)
const stageOrd = args['stage-ord'] != null ? parseInt(args['stage-ord'], 10) : null

// --- validate chapter Markdown (mechanical shape only) ---
const mdPath = resolve(process.cwd(), args.md)
if (!existsSync(mdPath)) fail(`md not found: ${args.md}`)
const md = readFileSync(mdPath, 'utf8')
const problems = []
if (!/^#\s+\S/m.test(md)) problems.push('missing a Markdown H1 title (# …)')
// no quotes/blockquotes: the story is told in plain prose
if (/^\s*>/m.test(md)) problems.push('no quotes/blockquotes allowed — tell the story in plain prose (found a `>` blockquote)')
// no bullet/numbered list blocks in the body (节 headings are H2, not list items)
const listLine = md.split('\n').find((l) => /^\s*([-*]\s|\d+\.\s)/.test(l))
if (listLine) problems.push(`body must be continuous prose — no list items (found: ${listLine.trim().slice(0, 40)})`)
if (/<\/?[a-z][\s\S]*?>/i.test(md)) problems.push('chapter must be Markdown, not HTML (found an HTML tag)')
if (/\{\{[A-Z_]+\}\}/.test(md)) problems.push('leftover {{PLACEHOLDER}}')
const hanzi = countHanzi(md)
if (hanzi < MIN_HANZI) problems.push(`正文 too short: ${hanzi} 汉字 (need ≥ ${MIN_HANZI}) — mine more real detail from the book md`)

// --- parse & validate numbered 节 (H2 `## <global-num> <title>`) ---
const secs = [...md.matchAll(/^##\s+(\d+)\s+(.+?)\s*$/gm)].map((m) => ({ num: parseInt(m[1], 10), title: m[2] }))
if (secs.length < 2) problems.push('chapter needs ≥2 numbered 节, each a heading `## <global-num> <节标题>`')
for (let i = 1; i < secs.length; i++)
  if (secs[i].num !== secs[i - 1].num + 1)
    problems.push(`节编号必须连续: 出现 ${secs[i - 1].num} → ${secs[i].num}`)
const sectionStart = secs.length ? secs[0].num : null
const sectionEnd = secs.length ? secs[secs.length - 1].num : null
if (problems.length) fail(`Markdown validation failed:\n  - ${problems.join('\n  - ')}`)

// --- validate questions JSON ---
const qPath = resolve(process.cwd(), args.questions)
if (!existsSync(qPath)) fail(`questions not found: ${args.questions}`)
let items
try { items = JSON.parse(readFileSync(qPath, 'utf8')) } catch (e) { fail(`questions JSON parse error: ${e.message}`) }
if (!Array.isArray(items) || !items.length) fail('questions must be a non-empty array')
let workCount = 0
items.forEach((q, i) => {
  if (!q.prompt || !q.type || !q.answer) fail(`question ${i}: prompt/type/answer required`)
  if (!['choice', 'work'].includes(q.answer_mode)) fail(`question ${i}: answer_mode must be choice|work`)
  if (q.answer_mode === 'work') workCount++
  if (q.answer_mode === 'choice') {
    if (!Array.isArray(q.options) || q.options.length < 2) fail(`question ${i}: choice needs >=2 options`)
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length)
      fail(`question ${i}: correct_index out of range`)
  }
})
if (workCount < 2) fail(`need ≥2 open 'work' questions (品格/思辨 口试); found ${workCount}`)

// --- render the print PDF (best effort; mirrors save-lesson.mjs renderPdf) ---
function printableHtml(bodyHtml) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: "Songti SC","Noto Serif CJK SC","Source Han Serif SC",Georgia,serif;
           color:#1c1a17; line-height:1.85; font-size:12.2pt; }
    .sr-reading { max-width: 100%; }
    h1 { font-size:19pt; margin:0 0 4pt; line-height:1.25; }
    h2 { font-size:13.5pt; margin:18pt 0 6pt; padding-top:2pt; color:#0f766e;
         border-top:1px solid #e6e2da; break-after: avoid; page-break-after: avoid; }
    p { margin:0 0 10pt; text-align: justify; }
  </style></head><body><article class="sr-reading">${bodyHtml}</article></body></html>`
}
async function renderPdf(html) {
  try {
    const { chromium } = await import('playwright-core')
    let browser
    try { browser = await chromium.launch() } catch { browser = await chromium.launch({ channel: 'chrome' }) }
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {})
      await page.waitForTimeout(300)
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

// --- DB ---
const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2] }
const url = env.EASYAPP_DATABASE_URL || env.DATABASE_URL
if (!url) fail('no EASYAPP_DATABASE_URL / DATABASE_URL in .env')
const sql = postgres(url, { ssl: 'require', max: 3, idle_timeout: 20, connection: { search_path: '"stemrobin-schema"' } })

async function main() {
  // Global section-number continuity: this chapter's first 节 must be the prior
  // chapter's last 节 + 1 (across the whole biography, ordered by `ord`).
  const prior = await sql`
    select coalesce(max(section_end), 0) as prev_max
    from sr_story_chapters where story_id = ${args.story} and ord < ${ord} and id <> ${args.chapter}
  `
  const prevMax = prior[0].prev_max || 0
  if (sectionStart !== prevMax + 1)
    fail(`全局小节编号不连续: 本章从 §${sectionStart} 起, 但上一章末节是 §${prevMax} (应从 §${prevMax + 1} 起). ` +
         `改小节编号或先保存前面的章节.`)

  const pdf = await renderPdf(printableHtml(marked.parse(md, { async: false })))

  await sql`
    insert into sr_stories (id, title, person, era, source_url, status, updated_at)
    values (${args.story}, ${args.title}, ${args.person}, ${args.era || null}, ${args['source-url']}, ${status}, now())
    on conflict (id) do update set title=excluded.title, person=excluded.person, era=excluded.era,
      source_url=excluded.source_url, status=excluded.status, updated_at=now()
  `
  await sql`
    insert into sr_story_chapters
      (id, story_id, ord, title, md, stage, stage_ord, section_start, section_end, pdf, status, updated_at)
    values (${args.chapter}, ${args.story}, ${ord}, ${args['chapter-title']}, ${md},
            ${args.stage || null}, ${stageOrd}, ${sectionStart}, ${sectionEnd}, ${pdf}, ${status}, now())
    on conflict (id) do update set story_id=excluded.story_id, ord=excluded.ord, title=excluded.title,
      md=excluded.md, stage=excluded.stage, stage_ord=excluded.stage_ord,
      section_start=excluded.section_start, section_end=excluded.section_end, pdf=excluded.pdf,
      status=excluded.status, updated_at=now()
  `
  await sql`delete from sr_story_questions where chapter_id = ${args.chapter}`
  let n = 0
  for (let i = 0; i < items.length; i++) {
    const q = items[i]
    await sql`
      insert into sr_story_questions (chapter_id, ord, type, prompt, answer_mode, options, correct_index, answer)
      values (${args.chapter}, ${q.ord ?? i + 1}, ${q.type}, ${q.prompt}, ${q.answer_mode},
              ${q.answer_mode === 'choice' ? sql.json(q.options) : null},
              ${q.answer_mode === 'choice' ? q.correct_index : null}, ${q.answer})
    `
    n++
  }
  console.log(`✓ sr_story_chapters[${args.chapter}] upserted: ${hanzi} 汉字, 节 §${sectionStart}–§${sectionEnd} ` +
              `(阶段 ${args.stage || '—'}), pdf ${pdf ? 'ok' : 'none'}; ${n} questions (status=${status})`)
  await sql.end()
}
main().catch((e) => {
  if (/relation .* does not exist|column .* does not exist/i.test(String(e && e.message))) {
    console.error('✗ story tables/columns missing — apply ssot-schemas/db-schemas/stemrobin.sql (sr_story_chapters needs md + stage/section/pdf columns).')
  } else console.error(e)
  process.exit(1)
})
