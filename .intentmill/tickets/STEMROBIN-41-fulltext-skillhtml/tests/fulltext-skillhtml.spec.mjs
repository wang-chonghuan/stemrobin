import crypto from 'node:crypto'
import pw from '/Users/yong/work/stemrobin-ws/stemrobin--STEMROBIN-41-fulltext-skillhtml/app/node_modules/playwright/index.js'
const { chromium } = pw

const BASE = 'http://localhost:3001'
const LESSON = 'math-s3-07'
const SHOT = '/private/tmp/claude-501/-Users-yong-work-stemrobin-ws-stemrobin/5a857074-7357-43b5-ad8a-17cb1ccf870d/scratchpad'

const SECRET = process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'
const uid = 2
const mac = crypto.createHmac('sha256', SECRET).update(String(uid)).digest('hex')
const token = `${uid}.${mac}`

const browser = await chromium.launch()
const ctx = await browser.newContext()
await ctx.addCookies([{ name: 'sr_session', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])

const results = {}

async function run(viewport, tag) {
  const page = await ctx.newPage()
  await page.setViewportSize(viewport)
  await page.goto(`${BASE}/lesson/${LESSON}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '全文速览' }).click()
  await page.waitForTimeout(1800)
  const frame = page.frameLocator('iframe')
  await frame.locator('body').waitFor({ timeout: 8000 })

  const facts = await page.evaluate(() => {
    const ifr = document.querySelector('iframe')
    const doc = ifr.contentDocument
    const body = doc.body
    const secNum = doc.querySelectorAll('.sr-sec-num').length
    const secLabel = doc.querySelectorAll('.sr-sec-label').length
    const html = body.innerHTML
    const hasOldFulltext = /sr-fulltext-/.test(html)
    const katex = doc.querySelectorAll('.katex').length
    const buttons = doc.querySelectorAll('button').length
    const inputs = doc.querySelectorAll('input').length
    const forms = doc.querySelectorAll('form').length
    const text = body.innerText
    const hasPractice = /练习|课后题/.test(text)
    const firstSecNumText = doc.querySelector('.sr-sec-num')?.textContent?.trim() || null
    const firstSecLabelText = doc.querySelector('.sr-sec-label')?.textContent?.trim() || null
    const leaksKey = /correct_index|"accept"|data-answer/.test(html)
    return { secNum, secLabel, hasOldFulltext, katex, buttons, inputs, forms, hasPractice, firstSecNumText, firstSecLabelText, leaksKey, iframeBodyScrollW: body.scrollWidth, iframeClientW: body.clientWidth, iframeOverflow: body.scrollWidth - body.clientWidth }
  })
  facts.pageScrollW = await page.evaluate(() => document.documentElement.scrollWidth)
  facts.pageClientW = await page.evaluate(() => document.documentElement.clientWidth)
  facts.pageOverflow = facts.pageScrollW - facts.pageClientW

  await page.screenshot({ path: `${SHOT}/fulltext-${tag}.png`, fullPage: false })
  results[tag] = facts
  await page.close()
}

try {
  await run({ width: 1280, height: 900 }, 'desktop')
  await run({ width: 375, height: 800 }, 'mobile')
  console.log(JSON.stringify(results, null, 2))
} catch (e) {
  console.error('ERROR', e)
  process.exitCode = 1
} finally {
  await browser.close()
}
