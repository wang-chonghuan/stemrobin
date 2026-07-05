#!/usr/bin/env node
// sr-story cap5 — deterministic persistence for a 名人传记 chapter (Markdown) +
// questions into the Azure easy-app Postgres (schema stemrobin-schema): upsert
// sr_stories + sr_story_chapters (md), and replace sr_story_questions for the
// chapter. Validates the Markdown shape + 正文 length mechanically (the gate judges
// meaning). Never echoes secrets.
//
// Usage (from repo root):
//   node .agents/skills/sr-story/scripts/save-story.mjs \
//     --story ford --title "亨利·福特" --person "亨利·福特（Henry Ford）" \
//     --era "1863–1947" --source-url "https://www.gutenberg.org/ebooks/7213" \
//     --chapter ford-c01 --ord 1 --chapter-title "少年与机器" --status draft \
//     --md <scratch>/ford-c01.md --questions <scratch>/ford-c01.questions.json
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
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

// --- validate chapter Markdown (mechanical shape only) ---
const mdPath = resolve(process.cwd(), args.md)
if (!existsSync(mdPath)) fail(`md not found: ${args.md}`)
const md = readFileSync(mdPath, 'utf8')
const problems = []
if (!/^#\s+\S/m.test(md)) problems.push('missing a Markdown H1 title (# …)')
// no quotes/blockquotes: the story is told in plain prose
if (/^\s*>/m.test(md)) problems.push('no quotes/blockquotes allowed — tell the story in plain prose (found a `>` blockquote)')
// no bullet/numbered list blocks in the body
const listLine = md.split('\n').find((l) => /^\s*([-*]\s|\d+\.\s)/.test(l))
if (listLine) problems.push(`body must be continuous prose — no list items (found: ${listLine.trim().slice(0, 40)})`)
if (/<\/?[a-z][\s\S]*?>/i.test(md)) problems.push('chapter must be Markdown, not HTML (found an HTML tag)')
if (/\{\{[A-Z_]+\}\}/.test(md)) problems.push('leftover {{PLACEHOLDER}}')
const hanzi = countHanzi(md)
if (hanzi < MIN_HANZI) problems.push(`正文 too short: ${hanzi} 汉字 (need ≥ ${MIN_HANZI}) — mine more real detail from the book md`)
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
// the reflective/口试 material lives in the questions, so require open items
if (workCount < 2) fail(`need ≥2 open 'work' questions (品格/思辨 口试); found ${workCount}`)

// --- DB ---
const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2] }
const url = env.EASYAPP_DATABASE_URL || env.DATABASE_URL
if (!url) fail('no EASYAPP_DATABASE_URL / DATABASE_URL in .env')
const sql = postgres(url, { ssl: 'require', max: 3, idle_timeout: 20, connection: { search_path: '"stemrobin-schema"' } })

async function main() {
  await sql`
    insert into sr_stories (id, title, person, era, source_url, status, updated_at)
    values (${args.story}, ${args.title}, ${args.person}, ${args.era || null}, ${args['source-url']}, ${status}, now())
    on conflict (id) do update set title=excluded.title, person=excluded.person, era=excluded.era,
      source_url=excluded.source_url, status=excluded.status, updated_at=now()
  `
  await sql`
    insert into sr_story_chapters (id, story_id, ord, title, md, status, updated_at)
    values (${args.chapter}, ${args.story}, ${parseInt(args.ord, 10)}, ${args['chapter-title']}, ${md}, ${status}, now())
    on conflict (id) do update set story_id=excluded.story_id, ord=excluded.ord, title=excluded.title,
      md=excluded.md, status=excluded.status, updated_at=now()
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
  console.log(`✓ sr_stories[${args.story}] + sr_story_chapters[${args.chapter}] upserted (${hanzi} 汉字); ${n} questions replaced (status=${status})`)
  await sql.end()
}
main().catch((e) => {
  if (/relation .* does not exist|column .* does not exist/i.test(String(e && e.message))) {
    console.error('✗ story tables/columns missing — apply ssot-schemas/db-schemas/stemrobin.sql (sr_story_chapters needs a `md` column).')
  } else console.error(e)
  process.exit(1)
})
