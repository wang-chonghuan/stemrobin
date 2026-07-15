import crypto from 'node:crypto'
import pw from '/Users/yong/work/stemrobin-ws/stemrobin--STEMROBIN-36-login-logout/app/node_modules/playwright/index.js'
const { chromium } = pw

const BASE = process.env.BASE || 'http://localhost:3001'
const SHOTS =
  '/Users/yong/work/stemrobin-ws/stemrobin--STEMROBIN-36-login-logout/.intentmill/tickets/STEMROBIN-36-login-logout/tests/shots'

// Mint the test-learner (user 2) HMAC session cookie — NO password typed.
const secret = process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'
const uid = '2'
const mac = crypto.createHmac('sha256', secret).update(uid).digest('hex')
const sessionValue = `${uid}.${mac}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
try {
  // ── (a) logged-out /login = bare login form, no sidebar ──
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    const hasAuthCard = await page.locator('.sr-auth-card').count()
    const hasForm = await page.locator('form.sr-login').count()
    const hasCatalog = await page.locator('.sr-catalog').count()
    const hasLessonLinks = await page.locator('a.sr-out-lesson').count()
    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    const hasRegister = /register|sign up|create account|注册|创建账号/.test(bodyText)
    await page.screenshot({ path: `${SHOTS}/a-loggedout-login.png`, fullPage: true })
    check('(a) login card renders', hasAuthCard === 1)
    check('(a) login form present', hasForm === 1)
    check('(a) NO catalog sidebar', hasCatalog === 0, `sr-catalog count=${hasCatalog}`)
    check('(a) NO lesson titles leaked', hasLessonLinks === 0, `lesson links=${hasLessonLinks}`)
    check('(a) NO register/create-account entry', !hasRegister)
    await ctx.close()
  }

  // ── (b) logged-in → app + visible logout control ──
  {
    const ctx = await browser.newContext()
    await ctx.addCookies([
      {
        name: 'sr_session',
        value: sessionValue,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const onApp = new URL(page.url()).pathname === '/'
    const hasCatalog = await page.locator('.sr-catalog').count()
    const logout = page.locator('button.sr-logout')
    const logoutVisible = await logout.isVisible().catch(() => false)
    const userShown = await page.locator('.sr-cat-user').innerText().catch(() => '')
    await page.screenshot({ path: `${SHOTS}/b-loggedin-app.png`, fullPage: true })
    check('(b) logged-in stays on app (/), not redirected', onApp, `url=${page.url()}`)
    check('(b) app shell + catalog present', hasCatalog === 1)
    check('(b) visible logout control', logoutVisible)
    check('(b) signed-in email shown', /@/.test(userShown), userShown)
    await ctx.close()
  }

  // ── (c) click logout → back to /login, protected page re-gated ──
  {
    const ctx = await browser.newContext()
    await ctx.addCookies([
      {
        name: 'sr_session',
        value: sessionValue,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.locator('button.sr-logout').click()
    await page.waitForURL('**/login', { timeout: 8000 })
    await page.waitForSelector('.sr-auth-card', { timeout: 8000 })
    const afterLogoutPath = new URL(page.url()).pathname
    const bareAfter = (await page.locator('.sr-auth-card').count()) === 1
    const catalogAfter = await page.locator('.sr-catalog').count()
    await page.screenshot({ path: `${SHOTS}/c-after-logout.png`, fullPage: true })

    // cookie cleared?
    const cookiesNow = await ctx.cookies()
    const sess = cookiesNow.find((c) => c.name === 'sr_session')
    const cookieCleared = !sess || sess.value === ''

    // protected page re-gated: navigate to / → should bounce to /login
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const regatedPath = new URL(page.url()).pathname

    check('(c) logout lands on /login', afterLogoutPath === '/login', `path=${afterLogoutPath}`)
    check('(c) post-logout page is bare (login card, no catalog)', bareAfter && catalogAfter === 0)
    check('(c) session cookie cleared', cookieCleared, sess ? `value="${sess.value}"` : 'absent')
    check('(c) protected / re-gated to /login', regatedPath === '/login', `path=${regatedPath}`)
    await ctx.close()
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(', '))
  process.exit(1)
}
