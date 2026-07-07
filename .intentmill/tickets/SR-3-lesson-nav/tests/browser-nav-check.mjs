// Ticket-scoped Playwright browser verification (SR-3-lesson-nav). Run:
//   node .intentmill/tickets/SR-3-lesson-nav/tests/browser-nav-check.mjs http://127.0.0.1:3100
// Verifies spec R2–R8: bottom prev/next nav on lesson pages, disabled boundary
// state, no nav on unknown ids, click navigation following AVAILABLE_LESSONS order.
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] || 'http://127.0.0.1:3100'
const shotsDir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots')
mkdirSync(shotsDir, { recursive: true })
const log = (m) => console.log(m)
let failed = false
const check = (cond, msg) => {
  log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failed = true
}

// AVAILABLE_LESSONS order (math stage 2): s2-03 first page, s2-08 last page.
const FIRST = 'math-s2-03'
const MIDDLE = 'math-s2-05'
const LAST = 'math-s2-08'
const UNKNOWN = 'math-s2-99'

let browser
try {
  browser = await chromium.launch({ headless: false })
} catch (e) {
  log(`! headed launch failed (${e.message}); retrying headless`)
  browser = await chromium.launch({ headless: true })
}

async function run(viewportName, viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const nav = () => page.locator('.sr-lesson-nav')
  const gotoLesson = async (id) => {
    await page.goto(`${BASE}/lesson/${id}`, { waitUntil: 'networkidle' })
  }

  // 1. Middle lesson: both controls visible, correct targets, at the bottom (R2/R3/R6/R7/R8)
  await gotoLesson(MIDDLE)
  await page.waitForSelector('.sr-lesson-nav', { timeout: 15000 })
  const prevLink = nav().locator('a', { hasText: '上一课' })
  const nextLink = nav().locator('a', { hasText: '下一课' })
  check(await prevLink.isVisible(), `[${viewportName}] middle lesson shows 上一课 link`)
  check(await nextLink.isVisible(), `[${viewportName}] middle lesson shows 下一课 link`)
  check(
    (await prevLink.innerText()).includes('2.4 项的身份证：系数与次数'),
    `[${viewportName}] 上一课 shows target numbered title (2.4)`,
  )
  check(
    (await nextLink.innerText()).includes('2.6 去括号'),
    `[${viewportName}] 下一课 shows target numbered title (2.6)`,
  )
  const iframeBox = await page.locator('.sr-d-scroll iframe').boundingBox()
  const navBox = await nav().boundingBox()
  check(
    !!iframeBox && !!navBox && navBox.y >= iframeBox.y + iframeBox.height - 1,
    `[${viewportName}] nav row sits below the lesson iframe (bottom placement)`,
  )
  const frame = page.frames().find((f) => f !== page.mainFrame())
  const bodyLen = frame ? (await frame.locator('body').innerText()).length : 0
  check(bodyLen > 100, `[${viewportName}] lesson content still renders (iframe text len=${bodyLen})`)
  await nav().scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(shotsDir, `middle-${viewportName}.png`), fullPage: false })

  // 2. Click 下一课 from middle -> goes to 2.6 (math-s2-06) (R3/R9 loader nav)
  await nextLink.click()
  await page.waitForURL(`${BASE}/lesson/math-s2-06`, { timeout: 15000 })
  check(page.url().endsWith('/lesson/math-s2-06'), `[${viewportName}] 下一课 navigates to math-s2-06`)
  await page.waitForSelector('.sr-lesson-nav', { timeout: 15000 })

  // 3. Click 上一课 from 2.6 -> back to 2.5 (R2)
  await nav().locator('a', { hasText: '上一课' }).click()
  await page.waitForURL(`${BASE}/lesson/${MIDDLE}`, { timeout: 15000 })
  check(page.url().endsWith(`/lesson/${MIDDLE}`), `[${viewportName}] 上一课 navigates back to ${MIDDLE}`)

  // 4. First page-bearing lesson: 上一课 disabled (no link), 下一课 active (R4)
  await gotoLesson(FIRST)
  await page.waitForSelector('.sr-lesson-nav', { timeout: 15000 })
  const prevDisabled = nav().locator('button:disabled', { hasText: '上一课' })
  check(await prevDisabled.isVisible(), `[${viewportName}] first lesson: 上一课 rendered disabled`)
  check(
    (await nav().locator('a', { hasText: '上一课' }).count()) === 0,
    `[${viewportName}] first lesson: no 上一课 link`,
  )
  check(
    await nav().locator('a', { hasText: '下一课' }).isVisible(),
    `[${viewportName}] first lesson: 下一课 still a link`,
  )
  await nav().scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(shotsDir, `first-${viewportName}.png`) })

  // 5. Last page-bearing lesson: 下一课 disabled, 上一课 active (R4)
  await gotoLesson(LAST)
  await page.waitForSelector('.sr-lesson-nav', { timeout: 15000 })
  check(
    await nav().locator('button:disabled', { hasText: '下一课' }).isVisible(),
    `[${viewportName}] last lesson: 下一课 rendered disabled`,
  )
  check(
    (await nav().locator('a', { hasText: '下一课' }).count()) === 0,
    `[${viewportName}] last lesson: no 下一课 link`,
  )
  check(
    await nav().locator('a', { hasText: '上一课' }).isVisible(),
    `[${viewportName}] last lesson: 上一课 still a link`,
  )
  await nav().scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(shotsDir, `last-${viewportName}.png`) })

  // 6. Unknown id: no nav row at all (R5)
  await gotoLesson(UNKNOWN)
  await page.waitForSelector('.sr-d-scroll', { timeout: 15000 })
  check(
    (await nav().count()) === 0,
    `[${viewportName}] unknown id ${UNKNOWN}: nav row absent`,
  )
  check(
    await page.getByText('课程内容尚未生成。').isVisible(),
    `[${viewportName}] unknown id shows the existing placeholder copy (unchanged)`,
  )
  await page.screenshot({ path: join(shotsDir, `unknown-${viewportName}.png`) })

  // 7. Regression: top bar controls still present on a lesson page
  await gotoLesson(MIDDLE)
  await page.waitForSelector('.sr-d-top', { timeout: 15000 })
  check(await page.getByRole('button', { name: '卡片答题' }).isVisible(), `[${viewportName}] 卡片答题 button intact`)
  check(await page.getByLabel('下载 PDF').isVisible(), `[${viewportName}] 下载 PDF button intact`)
  check(await page.getByText('返回').isVisible(), `[${viewportName}] 返回 link intact`)

  // 8. Regression: home page lesson list (AVAILABLE_LESSONS consumer) renders
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  check(
    await page.getByText(/新上线课程（\d+）/).isVisible(),
    `[${viewportName}] home 新上线课程 count renders (AVAILABLE_LESSONS consumer intact)`,
  )
  await ctx.close()
}

try {
  await run('desktop', { width: 1280, height: 800 })
  await run('mobile', { width: 390, height: 844 })
} catch (e) {
  failed = true
  log(`✗ unexpected error: ${e.message}`)
} finally {
  await browser.close()
}

log(failed ? 'RESULT: FAIL' : 'RESULT: PASS')
process.exit(failed ? 1 : 0)
