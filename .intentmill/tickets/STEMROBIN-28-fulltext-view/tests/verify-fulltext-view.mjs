// STEMROBIN-28 — browser verification for 全文速览 / 逐卡精读 toggle.
// Standalone Playwright (app/node_modules/playwright), headed=false. Run:
//   node .intentmill/tickets/STEMROBIN-28-fulltext-view/tests/verify-fulltext-view.mjs
// Requires the dev server on http://localhost:3000 (cd app && npm run dev).
//
// Asserts (black-box, logged-out):
//  1. lesson page shows the reading-mode switch; 逐卡精读 is the default (active).
//  2. 逐卡精读: card reader + read-checks present; card body renders KaTeX (.katex);
//     no raw unrendered $…$ left in the read-check area (STEMROBIN-27 intact).
//  3. 全文速览: whole lesson shown at once (all card bodies, one iframe), NO
//     .sr-card-check / .sr-card-nav / card reader, formulas render (.katex),
//     figures present, and NO record POST fires from merely viewing (no 进度).
//  4. switch back to 逐卡精读: read-checks return and formulas still render.
//  5. mobile 375px: no horizontal overflow in either mode.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
// Resolve the standalone Playwright from app/node_modules (the tests dir has no
// node_modules of its own). repo root is four levels up from this tests dir.
const repoRoot = join(here, '..', '..', '..', '..')
const require = createRequire(join(repoRoot, 'app', 'noop.cjs'))
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const LESSON = 'math-s3-07'
const shotDir = join(here, 'screenshots')

const results = []
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function frameOf(page, selector) {
  const h = await page.$(selector)
  if (!h) return null
  return await h.contentFrame()
}
async function waitKatex(frame, ms = 8000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if ((await frame.locator('.katex').count()) > 0) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}
const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  // Track POSTs to prove viewing full-text records nothing.
  const posts = []
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url())
  })

  await page.goto(`${BASE}/lesson/${LESSON}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sr-card-reader', { timeout: 15000 })

  // 1. switch present, 逐卡精读 default-active
  const modeButtons = page.locator('.sr-read-modes .sr-read-mode')
  check('reading-mode switch present with 2 options', (await modeButtons.count()) === 2)
  const cardsBtn = page.locator('.sr-read-mode', { hasText: '逐卡精读' })
  const fullBtn = page.locator('.sr-read-mode', { hasText: '全文速览' })
  check(
    '逐卡精读 is the default active mode',
    (await cardsBtn.getAttribute('class'))?.includes('active') &&
      (await cardsBtn.getAttribute('aria-pressed')) === 'true',
  )

  // 2. cards mode: read-checks + KaTeX in card body
  const cardChecksCards = await page.locator('.sr-card-check').count()
  check('逐卡精读 shows read-check items (.sr-card-check)', cardChecksCards > 0, `count=${cardChecksCards}`)
  const cardFrame = await frameOf(page, '.sr-card-frame-wrap iframe')
  check('card body iframe present', !!cardFrame)
  const cardBodyKatex = cardFrame ? await waitKatex(cardFrame) : false
  check('逐卡精读 card body renders formulas (.katex)', cardBodyKatex)
  // STEMROBIN-27 intact: no raw $…$ residue left in the (app-DOM) read-check area.
  const rawDollarInChecks = await page.evaluate(() => {
    const el = document.querySelector('.sr-card-checks')
    return el ? /\$[^$]+\$/.test(el.textContent || '') : false
  })
  check('STEMROBIN-27: no raw unrendered $…$ in read-check area', !rawDollarInChecks)
  await page.screenshot({ path: join(shotDir, 'cards-desktop.png'), fullPage: true })

  // 3. full-text mode
  const postsBefore = posts.length
  await fullBtn.click()
  await page.waitForTimeout(400)
  check('全文速览 active after toggle', (await fullBtn.getAttribute('aria-pressed')) === 'true')
  check('全文速览 has NO card reader', (await page.locator('.sr-card-reader').count()) === 0)
  check('全文速览 has NO read-check (.sr-card-check)', (await page.locator('.sr-card-check').count()) === 0)
  check('全文速览 has NO card nav (.sr-card-nav)', (await page.locator('.sr-card-nav').count()) === 0)

  // The full-text iframe is the LessonFrame (not inside .sr-card-frame-wrap).
  const fullFrame = await frameOf(page, '.sr-d-scroll > iframe')
  check('全文速览 renders one full-lesson iframe', !!fullFrame)
  let fullKatex = false
  let figures = 0
  let articleChildren = 0
  let fullTextLen = 0
  if (fullFrame) {
    fullKatex = await waitKatex(fullFrame)
    figures = await fullFrame.locator('article.sr-lesson figure').count()
    articleChildren = await fullFrame.evaluate(() => {
      const a = document.querySelector('article.sr-lesson')
      return a ? a.children.length : 0
    })
    fullTextLen = await fullFrame.evaluate(
      () => (document.querySelector('article.sr-lesson')?.textContent || '').length,
    )
  }
  check('全文速览 formulas render (.katex)', fullKatex)
  check('全文速览 shows whole content (many top-level blocks)', articleChildren >= 5, `children=${articleChildren}`)
  check('全文速览 preserves figures/diagrams', figures > 0, `figures=${figures}`)
  check('全文速览 body is substantial (whole lesson)', fullTextLen > 1500, `chars=${fullTextLen}`)
  check(
    '全文速览: viewing records nothing (no POST fired)',
    posts.length === postsBefore,
    `posts during view=${posts.length - postsBefore}`,
  )
  await page.screenshot({ path: join(shotDir, 'fulltext-desktop.png'), fullPage: true })

  // 4. back to 逐卡精读
  await cardsBtn.click()
  await page.waitForSelector('.sr-card-reader', { timeout: 10000 })
  const cardChecksBack = await page.locator('.sr-card-check').count()
  check('switch back to 逐卡精读 restores read-checks', cardChecksBack > 0, `count=${cardChecksBack}`)
  const cardFrame2 = await frameOf(page, '.sr-card-frame-wrap iframe')
  const cardKatexBack = cardFrame2 ? await waitKatex(cardFrame2) : false
  check('逐卡精读 formulas still render after toggle back', cardKatexBack)

  // 5. mobile 375px, both modes
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${BASE}/lesson/${LESSON}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sr-card-reader', { timeout: 15000 })
  await page.waitForTimeout(600)
  check('mobile 375px 逐卡精读: no horizontal overflow', await noOverflow(page))
  await page.locator('.sr-read-mode', { hasText: '全文速览' }).click()
  await page.waitForTimeout(800)
  check('mobile 375px 全文速览: no horizontal overflow', await noOverflow(page))
  await page.screenshot({ path: join(shotDir, 'fulltext-mobile-375.png'), fullPage: true })

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join('; '))
    process.exit(1)
  }
} finally {
  await browser.close()
}
