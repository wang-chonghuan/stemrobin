// Ticket-scoped Playwright browser verification (SR-1). Run:
//   node .intentmill/tickets/SR-1-exercise-cap-cardquiz/tests/browser-render-check.mjs http://127.0.0.1:3100
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:3100'
const LESSON = `${BASE}/lesson/math-s3-03`
const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots')
const log = (m) => console.log(m)
let failed = false
const check = (cond, msg) => {
  log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failed = true
}

let browser
try {
  browser = await chromium.launch({ headless: false })
} catch (e) {
  log(`! headed launch failed (${e.message}); retrying headless`)
  browser = await chromium.launch({ headless: true })
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

try {
  // 1. Lesson renders from the DB (iframe not blank)
  await page.goto(LESSON, { waitUntil: 'networkidle' })
  await page.waitForSelector('iframe', { timeout: 15000 })
  const frame = page.frames().find((f) => f !== page.mainFrame())
  const bodyLen = frame ? (await frame.locator('body').innerText()).length : 0
  check(bodyLen > 100, `lesson iframe renders content from DB (body text len=${bodyLen})`)
  check(await page.getByText('等式两边同乘同除').first().isVisible(), 'lesson title visible')

  // 2. Quiz button opens the drawer; not logged in => login prompt
  await page.getByRole('button', { name: '卡片答题' }).click()
  await page.waitForSelector('.sr-quiz-drawer', { timeout: 8000 })
  check(await page.locator('.sr-quiz-drawer').isVisible(), 'card-quiz drawer opens')
  const loginPrompt = await page.getByText('去登录').isVisible().catch(() => false)
  check(loginPrompt, 'unauthenticated quiz shows login prompt (answer-write gated)')

  // 3. Log in with the preset learner
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill('edwinbiz@hotmail.com')
  await page.locator('input[type=password]').fill('123456')
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL(`${BASE}/`, { timeout: 8000 }).catch(() => {})
  check(!page.url().includes('/login'), 'login with preset credentials succeeds')

  // 4. Quiz now shows cards; answer a choice card => feedback + reveal
  await page.goto(LESSON, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '卡片答题' }).click()
  await page.waitForSelector('.sr-quiz-card', { timeout: 8000 })
  check(await page.locator('.sr-quiz-prompt').first().isVisible(), 'quiz card prompt visible')
  const opts = page.locator('.sr-quiz-opt')
  check((await opts.count()) >= 2, 'choice card shows options')
  await opts.first().click()
  await page.waitForSelector('.sr-quiz-feedback', { timeout: 8000 })
  check(await page.locator('.sr-quiz-feedback').isVisible(), 'answering shows feedback')
  check(
    (await page.locator('.sr-quiz-answer').innerText()).length > 0,
    'answer is revealed after answering',
  )
  const correctMarked = await page.locator('.sr-quiz-opt.correct').count()
  check(correctMarked === 1, 'exactly one correct option is marked green')
  await page.screenshot({ path: join(shotsDir, 'desktop-quiz.png') })

  // 5. Advance to a work card => camera placeholder
  let sawWork = false
  for (let i = 0; i < 13; i++) {
    if (await page.locator('.sr-quiz-work').isVisible().catch(() => false)) { sawWork = true; break }
    const next = page.getByRole('button', { name: '下一题' })
    if (await next.isDisabled().catch(() => true)) break
    await next.click()
    await page.waitForTimeout(120)
  }
  check(sawWork, 'work-type card shows the camera/photo placeholder')

  // 6. Mobile viewport => drawer full-width
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(LESSON, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '卡片答题' }).click()
  await page.waitForSelector('.sr-quiz-drawer', { timeout: 8000 })
  const box = await page.locator('.sr-quiz-drawer').boundingBox()
  check(box && box.width >= 380, `mobile drawer is full-width (w=${box ? Math.round(box.width) : 0})`)
  await page.screenshot({ path: join(shotsDir, 'mobile-quiz.png') })

  log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS')
} catch (e) {
  log(`\n✗ script error: ${e.message}`)
  failed = true
  await page.screenshot({ path: join(shotsDir, 'error.png') }).catch(() => {})
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
