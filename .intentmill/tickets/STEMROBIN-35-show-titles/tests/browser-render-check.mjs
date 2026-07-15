// STEMROBIN-35 browser verification. Mints an sr_session cookie for the dedicated
// test learner (user 2) with SESSION_SECRET (dev fallback) — no password typed —
// then asserts, on math-s3-07:
//   card 精读:   section title (为什么学这个) + lesson title (去分母解方程) visible
//   全文速览:    lesson title + section headings (讲解 / 例题) + 课后题 list visible,
//                课后题 not answerable (no <button>), formulas render (.katex),
//                and NO POST (record/attempt/progress) fires when viewing 速览
//   mobile 375:  no horizontal overflow on the page or the iframe body
// Screenshots saved under ./screenshots/. Usage:
//   node browser-render-check.mjs http://127.0.0.1:3000
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:3000'
const LESSON = 'math-s3-07'
const here = dirname(fileURLToPath(import.meta.url))
const shots = join(here, 'screenshots')
// Resolve standalone Playwright from app/node_modules (script lives outside app).
const appDir = resolve(here, '../../../../app')
const require = createRequire(pathToFileURL(join(appDir, 'package.json')))
const { chromium } = require('playwright')

const SESSION_SECRET = process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'
const USER_ID = 2
const mac = crypto.createHmac('sha256', SESSION_SECRET).update(String(USER_ID)).digest('hex')
const sessionValue = `${USER_ID}.${mac}`

const fail = (m) => {
  console.error('FAIL:', m)
  process.exitCode = 1
}
const ok = (m) => console.log('PASS:', m)

const browser = await chromium.launch({ headless: false })
const origin = new URL(base).origin
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  storageState: {
    cookies: [
      { name: 'sr_session', value: sessionValue, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    ],
    origins: [],
  },
})
const page = await ctx.newPage()

// Track POST requests (record/attempt/progress server fns are POST; the read GET is safe).
const posts = []
page.on('request', (r) => {
  if (r.method() === 'POST') posts.push(r.url())
})

try {
  await page.goto(`${base}/lesson/${LESSON}`, { waitUntil: 'networkidle' })

  // ---- Card 精读 view (default) ----
  await page.waitForSelector('.sr-card-reader', { timeout: 15000 })
  const lessonTitle = (await page.locator('.sr-card-lesson').first().innerText()).trim()
  const sectionTitle = (await page.locator('.sr-card-section').first().innerText()).trim()
  lessonTitle.includes('去分母解方程') ? ok(`card lesson title: "${lessonTitle}"`) : fail(`card lesson title missing 去分母解方程 (got "${lessonTitle}")`)
  sectionTitle === '为什么学这个' ? ok(`card section title: "${sectionTitle}"`) : fail(`card section title expected 为什么学这个 (got "${sectionTitle}")`)
  await page.screenshot({ path: join(shots, 'card-view-desktop.png'), fullPage: true })

  // ---- Switch to 全文速览 ----
  const postsBefore = posts.length
  await page.getByRole('button', { name: '全文速览' }).click()
  // full-text is an iframe (srcDoc); wait for its article to render
  const frame = page.frameLocator('iframe[title*="去分母解方程"], .sr-d-scroll iframe')
  await frame.locator('article.sr-lesson').waitFor({ timeout: 15000 })
  await page.waitForTimeout(1500) // let KaTeX auto-render + height settle

  const ftTitle = await frame.locator('h1.sr-fulltext-title').first().innerText()
  ftTitle.includes('去分母解方程') ? ok(`速览 lesson title h1: "${ftTitle}"`) : fail(`速览 title h1 missing (got "${ftTitle}")`)

  const sectionHeadings = await frame.locator('h2.sr-fulltext-section').allInnerTexts()
  const hasSecs = ['为什么学这个', '讲解', '例题'].every((s) => sectionHeadings.some((h) => h.trim() === s))
  hasSecs ? ok(`速览 section headings: ${JSON.stringify(sectionHeadings)}`) : fail(`速览 section headings missing (got ${JSON.stringify(sectionHeadings)})`)

  const exVisible = await frame.locator('section.sr-fulltext-exercises').isVisible()
  const exLabel = await frame.locator('section.sr-fulltext-exercises h2').first().innerText()
  const exItems = await frame.locator('section.sr-fulltext-exercises > ol > li').count()
  exVisible && exLabel.trim() === '课后题' && exItems > 0
    ? ok(`速览 课后题 block: label "${exLabel.trim()}", ${exItems} items`)
    : fail(`速览 课后题 block wrong (visible=${exVisible}, label="${exLabel}", items=${exItems})`)

  // Not answerable: no interactive controls inside the exercises
  const exButtons = await frame.locator('section.sr-fulltext-exercises button, section.sr-fulltext-exercises input').count()
  exButtons === 0 ? ok('速览 课后题 have no answerable controls (0 button/input)') : fail(`速览 课后题 have ${exButtons} interactive controls`)

  // No record/attempt/progress POST fired while viewing 速览
  const newPosts = posts.slice(postsBefore)
  newPosts.length === 0 ? ok('no POST (record/attempt/progress) fired during 速览') : fail(`unexpected POSTs in 速览: ${JSON.stringify(newPosts)}`)

  // Formulas render (KaTeX) somewhere in the full text
  const katexCount = await frame.locator('.katex').count()
  katexCount > 0 ? ok(`KaTeX rendered in 速览 (.katex x${katexCount})`) : fail('no .katex nodes in 速览 (formulas not rendered)')

  await page.screenshot({ path: join(shots, 'fulltext-view-desktop.png'), fullPage: true })

  // ---- Mobile 375px: no horizontal overflow ----
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(800)
  const pageOverflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)
  pageOverflow <= 1 ? ok(`mobile page no horizontal overflow (Δ=${pageOverflow}px)`) : fail(`mobile page overflows by ${pageOverflow}px`)
  const frameOverflow = await frame.locator('body').evaluate((b) => b.scrollWidth - b.clientWidth)
  frameOverflow <= 1 ? ok(`mobile 速览 iframe body no horizontal overflow (Δ=${frameOverflow}px)`) : fail(`mobile 速览 iframe overflows by ${frameOverflow}px`)
  await page.screenshot({ path: join(shots, 'fulltext-view-mobile-375.png'), fullPage: true })
} catch (e) {
  fail(`exception: ${e.message}`)
} finally {
  await browser.close()
}

console.log(process.exitCode ? '\n=== RESULT: FAIL ===' : '\n=== RESULT: PASS ===')
