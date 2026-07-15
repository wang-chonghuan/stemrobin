// STEMROBIN-38 browser verification: locale-aware brand wordmark + en slogan hide.
// Standalone Playwright (app/node_modules/playwright). Mints the test-learner
// sr_session cookie (HMAC, user 2, no password typed) since the app is behind the
// auth gate. Asserts: zh header = 知更 + zh slogan; en header = stemrobin + no slogan.
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'

const BASE = process.argv[2] || 'http://127.0.0.1:3000'
const SESSION_SECRET = process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'
const USER_ID = 2
const here = path.dirname(fileURLToPath(import.meta.url))
const shotsDir = path.join(here, 'screenshots')
// Resolve the standalone Playwright from app/node_modules (this script lives
// outside app/, so anchor module resolution at the app project root).
const appRoot = path.resolve(here, '../../../../app')
const appRequire = createRequire(pathToFileURL(path.join(appRoot, 'package.json')))
const { chromium } = appRequire('playwright')

function signSession(userId) {
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(String(userId)).digest('hex')
  return `${userId}.${mac}`
}

const url = new URL(BASE)
const results = []
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({ headless: false })
try {
  const context = await browser.newContext()
  await context.addCookies([
    {
      name: 'sr_session',
      value: signSession(USER_ID),
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sr-brand-name', { timeout: 15000 })

  // ── zh (default locale) ──
  const zhBrand = (await page.locator('.sr-brand-name').first().innerText()).trim()
  const zhTaglineCount = await page.locator('.sr-tagline').count()
  const zhTagline = zhTaglineCount ? (await page.locator('.sr-tagline').first().innerText()).trim() : ''
  const brandImgCountZh = await page.locator('.sr-brand-img').count()
  check('zh wordmark reads 知更', zhBrand === '知更', `got "${zhBrand}"`)
  check('zh slogan present', zhTaglineCount === 1 && zhTagline.length > 0, `count=${zhTaglineCount} text="${zhTagline}"`)
  check('zh logo image present', brandImgCountZh === 1, `count=${brandImgCountZh}`)
  await page.screenshot({ path: path.join(shotsDir, 'header-zh.png'), clip: await headerClip(page) })

  // ── switch to EN ──
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.waitForFunction(() => {
    const el = document.querySelector('.sr-brand-name')
    return el && el.textContent.trim() === 'stemrobin'
  }, { timeout: 15000 })

  const enBrand = (await page.locator('.sr-brand-name').first().innerText()).trim()
  const enTaglineCount = await page.locator('.sr-tagline').count()
  const brandImgCountEn = await page.locator('.sr-brand-img').count()
  // single-line check: wordmark box height ~ one line (< 32px for 20px font)
  const box = await page.locator('.sr-brand-name').first().boundingBox()
  check('en wordmark reads stemrobin', enBrand === 'stemrobin', `got "${enBrand}"`)
  check('en slogan hidden (not rendered)', enTaglineCount === 0, `.sr-tagline count=${enTaglineCount}`)
  check('en logo image still present', brandImgCountEn === 1, `count=${brandImgCountEn}`)
  check('en wordmark on a single line', box && box.height < 32, `height=${box ? box.height.toFixed(1) : 'n/a'}px`)
  await page.screenshot({ path: path.join(shotsDir, 'header-en.png'), clip: await headerClip(page) })

  // ── switch back to zh: unchanged ──
  await page.getByRole('button', { name: '中', exact: true }).click()
  await page.waitForFunction(() => {
    const el = document.querySelector('.sr-brand-name')
    return el && el.textContent.trim() === '知更'
  }, { timeout: 15000 })
  const zhBrand2 = (await page.locator('.sr-brand-name').first().innerText()).trim()
  const zhTagline2 = await page.locator('.sr-tagline').count()
  check('zh restored: wordmark 知更', zhBrand2 === '知更', `got "${zhBrand2}"`)
  check('zh restored: slogan present again', zhTagline2 === 1, `count=${zhTagline2}`)
} finally {
  await browser.close()
}

async function headerClip(page) {
  const b = await page.locator('.sr-cat-head').first().boundingBox()
  if (!b) return undefined
  return { x: Math.max(0, b.x - 4), y: Math.max(0, b.y - 4), width: b.width + 8, height: b.height + 8 }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
