// Ticket-scoped browser verification for STEMROBIN-22 (card-by-card 精读 flow).
// Drives the real app with a logged-in test learner (user_id 2, session cookie
// minted from the default SESSION_SECRET — no password handling) and asserts:
//   1. one numbered card at a time; practice locked until read
//   2. the read-check fetch payload carries NO answer KEY (correct_index/accept)
//   3. wrong answer → "回到本卡再读一遍" re-read prompt + retry, next stays locked
//   4. correct answer → card passes → next card appears
//   5. all cards passed → 读完 state → practice deck opens
//   6. narrow mobile viewport: no horizontal overflow
// Usage: node browser-render-check.mjs http://127.0.0.1:3000
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
// Resolve playwright from the standalone app project (its own node_modules), since
// this script lives outside app/. Path is relative to this file → portable.
const appRequire = createRequire(join(HERE, '../../../../app/package.json'))
const { chromium } = appRequire('playwright')

const BASE = process.argv[2] || 'http://127.0.0.1:3000'
const LESSON = 'math-s2-01'
const SHOTS = join(HERE, 'screenshots')
const COOKIE = '2.9ef26e88e677fd003263061c40c5a690ffac75630b872a133056310135531a33'

// Per-card correct answers (from the DB KEY; the browser never sees these).
// choice → correct option index; input → correct text. Order = card order.
const KEY = {
  'math-s2-01-motivation-rc0': { choice: 0 },
  'math-s2-01-motivation-rc1': { choice: 0 },
  'math-s2-01-explain-rc0': { choice: 0 },
  'math-s2-01-explain-rc1': { input: '3a' },
  'math-s2-01-examples-rc0': { choice: 0 },
  'math-s2-01-examples-rc1': { input: '28' },
  'math-s2-01-connections-rc0': { choice: 0 },
  'math-s2-01-connections-rc1': { choice: 0 },
}

const results = []
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({ headless: false })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.addCookies([
  { name: 'sr_session', value: COOKIE, domain: '127.0.0.1', path: '/', httpOnly: true },
])

// Capture the ACTUAL reading DATA payload (the client-side server-fn RPC response),
// so we can assert it carries no answer KEY. Filter strictly: it must be the data
// response (content-type is NOT javascript/html dev source) and contain the card
// field `bodyHtml`. This excludes Vite dev-mode .ts/.tsx SOURCE modules (which
// legitimately mention correct_index/accept in type defs/comments — not data).
const payloads = []
ctx.on('response', async (resp) => {
  try {
    const ct = resp.headers()['content-type'] || ''
    if (/javascript|text\/html/i.test(ct)) return // skip dev source + documents
    const body = await resp.text()
    if (body.includes('bodyHtml')) payloads.push({ url: resp.url(), ct, body })
  } catch {}
})

const page = await ctx.newPage()

try {
  // ── 1. Open the lesson via SPA navigation so getLessonReading runs as a real
  // client RPC (the browser-facing payload the ticket asks us to inspect). ──
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: /用字母表示数/ }).first().click()
  await page.waitForSelector('.sr-card-reader', { timeout: 15000 })
  await page.waitForTimeout(500)

  const progress1 = (await page.locator('.sr-card-progress').innerText()).replace(/\s+/g, ' ').trim()
  check('shows one numbered card (第 1 / 5)', /第\s*1\s*\/\s*5/.test(progress1), progress1)

  const frames0 = await page.locator('.sr-card-frame-wrap iframe').count()
  check('exactly one card body iframe visible', frames0 === 1, `count=${frames0}`)

  const practiceLocked = await page.getByRole('button', { name: /练习题/ }).isDisabled()
  check('practice button locked before reading', practiceLocked === true)

  // ── 2. Read-check fetch payload carries card data but NO answer KEY ──
  const joined = payloads.map((p) => p.body).join('\n')
  check('reading data payload captured (client RPC)', payloads.length > 0, `${payloads.length} payload(s)`)
  check('payload actually carries card data (bodyHtml + read-check prompt)', joined.includes('bodyHtml') && joined.includes('本卡'))
  check('payload has NO correct_index', joined.length > 0 && !joined.includes('correct_index'))
  check('payload has NO accept list', joined.length > 0 && !joined.includes('accept'))
  check('payload has NO "key" field', joined.length > 0 && !joined.includes('"key"'))

  await page.screenshot({ path: join(SHOTS, 'card1-desktop.png'), fullPage: true })

  // Helper: within the current card, answer the i-th read-check.
  async function answerCheck(cardChecks, i, mode, value) {
    const check = cardChecks.nth(i)
    if (mode === 'choice') {
      await check.locator('.sr-quiz-opt').nth(value).click()
    } else {
      await check.locator('input.sr-quiz-input-field').fill(String(value))
      await check.getByRole('button', { name: /提交/ }).click()
    }
  }

  // ── 3+4. Card 1: wrong first (re-read prompt, still locked), then correct ──
  let checks = page.locator('.sr-card-check')
  // wrong pick on rc0 (correct is 0, so pick 1)
  await checks.nth(0).locator('.sr-quiz-opt').nth(1).click()
  await page.waitForSelector('.sr-card-check-verdict.bad', { timeout: 8000 })
  const reread = await page.locator('.sr-card-check-verdict.bad').first().innerText()
  check('wrong answer shows re-read guidance', /回到本卡再读/.test(reread), reread.trim())
  const nextLockedAfterWrong = await page.locator('.sr-card-locked').count()
  check('next card still locked after wrong answer', nextLockedAfterWrong > 0)
  await page.screenshot({ path: join(SHOTS, 'card1-wrong-reread.png'), fullPage: true })

  // now correct rc0 and rc1
  await checks.nth(0).locator('.sr-quiz-opt').nth(0).click()
  await page.waitForTimeout(400)
  await checks.nth(1).locator('.sr-quiz-opt').nth(0).click()
  await page.waitForTimeout(400)
  const nextBtn = page.getByRole('button', { name: /下一张卡片/ })
  check('next-card control appears after card 1 passes', (await nextBtn.count()) > 0 && !(await nextBtn.isDisabled()))

  // ── Walk the remaining cards, answering correctly, to reach 读完 ──
  const cardPlan = [
    [{ i: 0, mode: 'choice', v: 0 }, { i: 1, mode: 'choice', v: 0 }], // card1 done above
    [{ i: 0, mode: 'choice', v: 0 }, { i: 1, mode: 'input', v: '3a' }], // card2 explain
    [{ i: 0, mode: 'choice', v: 0 }, { i: 1, mode: 'input', v: '28' }], // card3 examples
    [{ i: 0, mode: 'choice', v: 0 }, { i: 1, mode: 'choice', v: 0 }], // card4 connections
    // card5 oral: no read-check → auto-pass
  ]

  for (let c = 1; c <= 4; c++) {
    await page.getByRole('button', { name: /下一张卡片/ }).click()
    await page.waitForTimeout(500)
    const prog = (await page.locator('.sr-card-progress').innerText()).replace(/\s+/g, ' ').trim()
    check(`advanced to card ${c + 1}`, new RegExp(`第\\s*${c + 1}\\s*/`).test(prog), prog)
    if (c < 4) {
      checks = page.locator('.sr-card-check')
      for (const step of cardPlan[c]) {
        await answerCheck(checks, step.i, step.mode, step.v)
        await page.waitForTimeout(450)
      }
    }
  }

  // Card 5 (oral) has no read-check → 读完 completion appears.
  await page.waitForSelector('.sr-card-done', { timeout: 8000 })
  const done = await page.locator('.sr-card-done-badge').innerText()
  check('all cards read → 读完 completion shown', /读完/.test(done), done.trim())
  const practiceUnlocked = await page.getByRole('button', { name: /练习题/ }).isEnabled()
  check('practice button unlocked after reading', practiceUnlocked === true)
  await page.screenshot({ path: join(SHOTS, 'all-read-desktop.png'), fullPage: true })

  // ── 5. Practice deck opens ──
  await page.getByRole('button', { name: /进入练习/ }).click()
  await page.waitForSelector('.sr-quiz-drawer', { timeout: 8000 })
  check('practice deck (quiz drawer) opens after reading', true)
  await page.screenshot({ path: join(SHOTS, 'practice-open-desktop.png'), fullPage: true })
  // close drawer
  await page.locator('.sr-quiz-close').click().catch(() => {})

  // ── 6. Mobile viewport: no horizontal overflow ──
  const mpage = await ctx.newPage()
  await mpage.setViewportSize({ width: 375, height: 812 })
  await mpage.goto(`${BASE}/lesson/${LESSON}`, { waitUntil: 'networkidle' })
  await mpage.waitForSelector('.sr-card-reader', { timeout: 15000 })
  await mpage.waitForTimeout(1500) // let KaTeX + iframe settle
  const overflow = await mpage.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }))
  check('mobile: no horizontal overflow', overflow.doc <= overflow.win + 1, `scrollW=${overflow.doc} winW=${overflow.win}`)
  // also check the card iframe body isn't wider than the viewport
  const frameOverflow = await mpage.evaluate(() => {
    const f = document.querySelector('.sr-card-frame-wrap iframe')
    if (!f || !f.contentDocument) return { has: false }
    const b = f.contentDocument.body
    return { has: true, scrollW: b.scrollWidth, clientW: b.clientWidth }
  })
  check(
    'mobile: card body content not wider than frame',
    !frameOverflow.has || frameOverflow.scrollW <= frameOverflow.clientW + 2,
    JSON.stringify(frameOverflow),
  )
  await mpage.screenshot({ path: join(SHOTS, 'card1-mobile.png'), fullPage: true })
} catch (e) {
  check('script completed without exception', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
if (failed.length) {
  console.log('FAILURES:', failed.map((f) => f.name).join('; '))
  process.exit(1)
}
