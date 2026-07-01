#!/usr/bin/env node
// save-lesson.mjs — deterministic persistence for an sr-lesson math lesson.
// Validates the rendered HTML mechanically, ensures it lives at
// public/lessons/<id>.html, and upserts the row into stemrobin.sr_lessons via
// psql using the connection string in the repo-root .env. Never echoes the password.
//
// Usage (from anywhere in the repo):
//   node .agents/skills/sr-lesson/scripts/save-lesson.mjs \
//     --id math-s1-01 --subject math --stage 1 --order 1 \
//     --title "数轴上的位置" --concept "..." --status draft \
//     --html public/lessons/math-s1-01.html

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1) }

// --- repo root ---
let repoRoot
try {
  repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
} catch { fail('not inside a git repo (cannot resolve repo root)') }

// --- args ---
const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ }
}
const required = ['id', 'subject', 'stage', 'order', 'title', 'html']
for (const k of required) if (!args[k]) fail(`missing --${k}`)
const status = args.status || 'draft'
if (!['draft', 'published'].includes(status)) fail(`--status must be draft|published`)
if (args.subject !== 'math') fail('only --subject math is supported this stage')
if (!/^math-s\d+-\d{2}$/.test(args.id)) fail(`--id must look like math-s1-01 (got ${args.id})`)

// --- read & validate the HTML (mechanical shape only; the gate judges meaning) ---
const htmlSrc = resolve(process.cwd(), args.html)
if (!existsSync(htmlSrc)) fail(`html file not found: ${args.html}`)
const html = readFileSync(htmlSrc, 'utf8')

const problems = []
for (const sec of ['motivation', 'explain', 'examples', 'connections', 'oral', 'practice']) {
  if (!html.includes(`data-sr-section="${sec}"`)) problems.push(`missing section anchor: ${sec}`)
}
if (!/katex/i.test(html)) problems.push('KaTeX not wired (no katex reference)')
if (!html.includes('--sr-')) problems.push('DESIGN tokens missing (no --sr- variables)')
if (/\{\{[A-Z_]+\}\}/.test(html)) problems.push('leftover {{PLACEHOLDER}} in html')
if (html.length < 1500) problems.push(`html suspiciously short (${html.length} bytes)`)
if (problems.length) fail(`HTML validation failed:\n  - ${problems.join('\n  - ')}`)

// --- ensure the file lives at public/lessons/<id>.html ---
const htmlPathRel = `lessons/${args.id}.html`
const dest = join(repoRoot, 'public', htmlPathRel)
mkdirSync(dirname(dest), { recursive: true })
if (resolve(dest) !== resolve(htmlSrc)) copyFileSync(htmlSrc, dest)
console.log(`✓ static file: public/${htmlPathRel}`)

// --- pre-render a print-ready PDF (headless Chromium) next to the HTML ---
// Done here, at authoring time, so the deployed app serves a STATIC pdf and never
// needs a browser at runtime. Uses the Playwright-managed Chromium, falling back
// to the system Chrome. A CJK web font (in the lesson CSS) makes Chinese embed.
const pdfPathRel = `lessons/${args.id}.pdf`
try {
  const { chromium } = await import('playwright-core')
  let browser
  try {
    browser = await chromium.launch()
  } catch {
    browser = await chromium.launch({ channel: 'chrome' })
  }
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page
      .waitForFunction(() => window.katex && document.querySelectorAll('.katex').length > 0, null, { timeout: 6000 })
      .catch(() => {})
    await page.evaluate(() => document.fonts.ready.then(() => true)) // wait for the CJK web font
    await page.waitForTimeout(400)
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
    writeFileSync(join(repoRoot, 'public', pdfPathRel), pdf)
    console.log(`✓ pdf: public/${pdfPathRel} (${Math.round(pdf.length / 1024)} KB)`)
  } finally {
    await browser.close()
  }
} catch (e) {
  // Non-fatal: HTML + DB still persist even if no browser is available here.
  console.error(`! PDF not generated (${(e && e.message) || e}). Install a browser to enable it.`)
}

// --- DB connection from .env ---
const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const dbUrl = env.SUPABASE_POOLER_URL || env.SUPABASE_DB_URL
if (!dbUrl) fail('no SUPABASE_POOLER_URL or SUPABASE_DB_URL in .env')

// Parse postgresql://user:pass@host:port/db where pass may itself contain '@'.
const m = dbUrl.match(/^postgres(?:ql)?:\/\/(.+)@([^@/]+):(\d+)\/(.+)$/)
if (!m) fail('could not parse the Postgres connection string')
const userInfo = m[1]
const ci = userInfo.indexOf(':')
const dbUser = userInfo.slice(0, ci)
const dbPass = userInfo.slice(ci + 1)
const [dbHost, dbPort, dbName] = [m[2], m[3], m[4]]

// --- build dollar-quoted upsert (handles arbitrary HTML/text safely) ---
const Q = (s) => `$srq$${s}$srq$`           // for title/concept
const H = (s) => `$srhtml$${s}$srhtml$`     // for html body
const sql = `
INSERT INTO stemrobin.sr_lessons
  (id, subject, stage, lesson_order, title, concept, html, status, updated_at)
VALUES
  (${Q(args.id)}, ${Q(args.subject)}, ${parseInt(args.stage, 10)}, ${parseInt(args.order, 10)},
   ${Q(args.title)}, ${Q(args.concept || '')}, ${H(html)}, ${Q(status)}, now())
ON CONFLICT (id) DO UPDATE SET
  subject = EXCLUDED.subject, stage = EXCLUDED.stage, lesson_order = EXCLUDED.lesson_order,
  title = EXCLUDED.title, concept = EXCLUDED.concept, html = EXCLUDED.html,
  status = EXCLUDED.status, updated_at = now();
`
const sqlFile = join(repoRoot, '.tmp-save-lesson.sql')
writeFileSync(sqlFile, sql)

try {
  execFileSync('psql',
    ['-h', dbHost, '-p', dbPort, '-U', dbUser, '-d', dbName, '-v', 'ON_ERROR_STOP=1', '-q', '-f', sqlFile],
    { env: { ...process.env, PGPASSWORD: dbPass }, stdio: ['ignore', 'inherit', 'inherit'] })
} catch {
  fail('psql upsert failed (is psql installed and the schema applied?)')
} finally {
  try { execFileSync('rm', ['-f', sqlFile]) } catch {}
}

console.log(`✓ db row upserted: stemrobin.sr_lessons[${args.id}] status=${status}`)
console.log(`→ frontend can load it at /${htmlPathRel}`)
