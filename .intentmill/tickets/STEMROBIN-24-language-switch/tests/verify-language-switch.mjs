// Standalone Playwright verification for STEMROBIN-24 (language switch + en math
// end-to-end). Uses app/node_modules/playwright directly (the playwright-test MCP
// harness has a version conflict in this repo). Mints the sr_session cookie for
// the dedicated test learner (user_id 2) — no password typed. READ-only on content;
// it answers a read-check + a practice question (disposable sr_*answer_events rows).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

// Resolve playwright from the app's own node_modules (runbook: standalone driver
// using app/node_modules/playwright — the MCP harness has a version conflict).
const require = createRequire(new URL('../../../../app/package.json', import.meta.url))
const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
const OUT = new URL('../refs/verification/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const SESSION =
  '2.9ef26e88e677fd003263061c40c5a690ffac75630b872a133056310135531a33'

const readingPayloads = []
const questionPayloads = []

function fail(msg) {
  console.error('FAIL: ' + msg)
  process.exitCode = 1
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
await ctx.addCookies([
  { name: 'sr_session', value: SESSION, url: BASE },
  { name: 'sr_locale', value: 'zh', url: BASE },
])
const page = await ctx.newPage()

// Capture server-fn JSON responses for the reading + questions endpoints so we can
// assert the browser payload never carries an answer KEY.
const jsonUrls = []
page.on('response', async (res) => {
  const url = res.url()
  const ct = res.headers()['content-type'] || ''
  if (!ct.includes('application/json')) return
  let body
  try {
    body = await res.text()
  } catch {
    return
  }
  jsonUrls.push(url)
  // TanStack server-fn calls carry the fn name in the query (?createServerFn or
  // the functionId). Match on the lesson id + payload markers to be robust.
  if (/reading|getLessonReading/i.test(url) || /"cards"|"bodyHtml"|"readChecks"/.test(body))
    readingPayloads.push({ url, body })
  if (/getLessonQuestions|quiz|question/i.test(url) || /"answerMode"|"prompt"/.test(body))
    questionPayloads.push({ url, body })
})

// ── 1. zh baseline: full outline ─────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const zhCatalog = await page.locator('.sr-catalog').innerText()
if (!zhCatalog.includes('数轴和有理数')) fail('zh catalog missing stage 1 (数轴和有理数)')
if (!zhCatalog.includes('课程大纲')) fail('zh catalog missing 课程大纲 header')
await page.screenshot({ path: OUT + '01-zh-catalog.png', fullPage: false })
console.log('OK: zh catalog shows full outline (数轴和有理数 present)')

// ── 2. switch to English ─────────────────────────────────────────────────────
await page.locator('.sr-lang-opt', { hasText: 'EN' }).click()
await page.waitForTimeout(800)
const enCatalog = await page.locator('.sr-catalog').innerText()
if (!/curriculum/i.test(enCatalog)) fail('en catalog missing localized header (Curriculum)')
if (!enCatalog.includes('Letters and Algebraic Expressions'))
  fail('en catalog missing translated stage 2')
if (!enCatalog.includes('Using Letters to Represent Numbers'))
  fail('en catalog missing translated lesson title')
// untranslated-hidden: stage 1 (数轴和有理数) and its lessons must NOT appear in en
if (enCatalog.includes('数轴和有理数') || /有理数加法|数轴上的位置/.test(enCatalog))
  fail('en catalog still shows untranslated stage-1 lessons')
// The outline rows themselves must be pure English (the 中/EN switch label + 知更
// brand are chrome, not outline content — scan only the lesson/stage rows).
const enOutline = await page.locator('.sr-out-lessons, .sr-out-stage-name, .sr-out-subject-name').allInnerTexts()
const strayCn = enOutline.filter((s) => /[一-鿿]/.test(s))
if (strayCn.length) fail('en outline has stray Chinese: ' + JSON.stringify(strayCn))
await page.screenshot({ path: OUT + '02-en-catalog.png', fullPage: false })
console.log('OK: en catalog localized; untranslated stages hidden; no stray Chinese')

// ── 3. open a translated lesson in en, walk a card + read-check ───────────────
await page.locator('.sr-out-lesson.ready', { hasText: 'Using Letters to Represent Numbers' }).click()
await page.waitForTimeout(1200)
const cardHead = await page.locator('.sr-card-head').innerText()
if (!/Card\s+1\s*\//.test(cardHead)) fail('en card progress not localized: ' + cardHead)
// read-check title localized
const checksTitle = await page.locator('.sr-card-checks-title').first().innerText().catch(() => '')
if (checksTitle && !/Read-check/i.test(checksTitle)) fail('read-check title not localized: ' + checksTitle)
// card body (iframe) prose should be English
const frame = page.frameLocator('.sr-card-frame-wrap iframe')
const cardText = await frame.locator('article').innerText()
if (/[一-鿿]/.test(cardText)) fail('en card body still contains Chinese prose')
if (!/[A-Za-z]{4,}/.test(cardText)) fail('en card body has no English prose')
await page.screenshot({ path: OUT + '03-en-lesson-card.png', fullPage: true })
console.log('OK: en lesson card prose + read-check rendered in English')

// answer the first read-check (choice) — click each option until the verdict is OK
const optionButtons = page.locator('.sr-card-check').first().locator('.sr-quiz-opt')
const nOpts = await optionButtons.count()
let readCheckJudged = false
for (let i = 0; i < nOpts; i++) {
  await optionButtons.nth(i).click()
  await page.waitForTimeout(500)
  const verdict = await page.locator('.sr-card-check-verdict').first().innerText().catch(() => '')
  if (/Correct/i.test(verdict)) { readCheckJudged = true; break }
  if (/Not quite/i.test(verdict)) { readCheckJudged = true } // wrong verdict also = server judged
}
if (!readCheckJudged) fail('read-check produced no server verdict')
await page.screenshot({ path: OUT + '04-en-readcheck-verdict.png', fullPage: true })
console.log('OK: en read-check judged server-side (verdict shown)')

// ── 4. open practice, verify English + judging ───────────────────────────────
// Walk every card to unlock practice: on each card answer all its read-checks
// (choice) by trying options until each shows the OK verdict, then advance.
for (let step = 0; step < 20; step++) {
  const doneBtn = page.locator('.sr-card-done button', { hasText: 'Start practice' })
  if (await doneBtn.count()) break
  const checks = page.locator('.sr-card-check')
  const cCount = await checks.count()
  // Candidate answers for this lesson's input read-checks (from the neutral KEY,
  // read-only) so the harness can satisfy the soft gate; the APP still judges.
  const inputCandidates = ['3a', '28']
  for (let c = 0; c < cCount; c++) {
    const chk = checks.nth(c)
    if (await chk.locator('.sr-card-check-verdict.ok').count()) continue
    const opts = chk.locator('.sr-quiz-opt')
    const on = await opts.count()
    if (on > 0) {
      for (let i = 0; i < on; i++) {
        if (await chk.locator('.sr-card-check-verdict.ok').count()) break
        await opts.nth(i).click()
        await page.waitForTimeout(350)
      }
    } else {
      // input-mode read-check: try each candidate answer until the OK verdict.
      const field = chk.locator('.sr-quiz-input-field')
      const submit = chk.locator('button', { hasText: 'Submit' })
      for (const cand of inputCandidates) {
        if (await chk.locator('.sr-card-check-verdict.ok').count()) break
        await field.fill(cand)
        await submit.click()
        await page.waitForTimeout(400)
      }
    }
  }
  const next = page.locator('.sr-card-nav button', { hasText: 'Next card' })
  if ((await next.count()) && (await next.isEnabled())) {
    await next.click()
    await page.waitForTimeout(450)
  } else if (!(await page.locator('.sr-card-done').count())) {
    // not last card yet but Next disabled → a check is still unanswered; retry loop
    await page.waitForTimeout(300)
  }
}
await page.waitForTimeout(400)
// Open the practice drawer: prefer the done-panel button, else the (now enabled)
// top-bar Practice button.
const doneStart = page.locator('.sr-card-done button', { hasText: 'Start practice' })
const topPractice = page.locator('.sr-d-top button', { hasText: 'Practice' })
if (await doneStart.count()) {
  await doneStart.click()
} else if ((await topPractice.count()) && (await topPractice.isEnabled())) {
  await topPractice.click()
} else {
  await page.screenshot({ path: OUT + 'DEBUG-stuck.png', fullPage: true })
  fail('could not unlock/open practice (allRead not reached)')
}
await page.waitForTimeout(900)
// If a start/gate phase shows, begin a fresh attempt.
const restart = page.locator('.sr-quiz-gate-actions button', { hasText: 'Start over' })
if (await restart.count()) { await restart.click(); await page.waitForTimeout(800) }

const drawer = page.locator('.sr-quiz-drawer')
if (await drawer.count()) {
  const drawerText = await drawer.innerText()
  await page.screenshot({ path: OUT + '05-en-practice.png', fullPage: true })
  const prompt = await page.locator('.sr-quiz-prompt').first().innerText().catch(() => '')
  if (prompt && /[一-鿿]/.test(prompt)) fail('en practice prompt contains Chinese: ' + prompt)
  console.log('OK: en practice drawer open; prompt="' + prompt.slice(0, 60) + '"')
  // answer one practice question (choice), verify a server verdict appears
  const qOpts = page.locator('.sr-quiz-options .sr-quiz-opt')
  if (await qOpts.count()) {
    await qOpts.first().click()
    await page.waitForTimeout(700)
    const v = await page.locator('.sr-quiz-verdict').first().innerText().catch(() => '')
    if (!/Correct|Wrong/i.test(v)) fail('practice answer produced no server verdict: ' + v)
    // reveal explanation must NOT be Chinese under en (suppressed)
    const reveal = await page.locator('.sr-quiz-answer').first().innerText().catch(() => '')
    if (/[一-鿿]/.test(reveal)) fail('en practice reveal shows Chinese explanation: ' + reveal)
    await page.screenshot({ path: OUT + '06-en-practice-verdict.png', fullPage: true })
    console.log('OK: en practice judged server-side; reveal not half-Chinese (verdict="' + v.trim() + '")')
  } else {
    fail('no practice options found in en drawer')
  }
} else {
  fail('practice drawer did not open in en')
}

// ── 5. no-KEY assertions on the captured en payloads ─────────────────────────
const keyRe = /"correct_index"|"accept"|"answer"\s*:/
for (const p of readingPayloads) {
  if (keyRe.test(p.body)) fail('reading payload leaked a KEY: ' + p.url)
}
for (const p of questionPayloads) {
  if (/"correct_index"|"accept"/.test(p.body)) fail('questions payload leaked a KEY: ' + p.url)
}
if (readingPayloads.length === 0 && questionPayloads.length === 0)
  fail('captured no reading/questions payloads — no-KEY assertion would be vacuous')
console.log(
  `OK: no KEY in captured payloads (reading=${readingPayloads.length}, questions=${questionPayloads.length})`,
)

// ── 6. switch back to zh, confirm restored ───────────────────────────────────
// close the practice drawer first (its scrim would intercept the switch click)
const quizClose = page.locator('.sr-quiz-close')
if (await quizClose.count()) { await quizClose.click(); await page.waitForTimeout(400) }
await page.locator('.sr-lang-opt', { hasText: '中' }).click()
await page.waitForTimeout(900)
const zhAgain = await page.locator('.sr-catalog').innerText()
if (!zhAgain.includes('数轴和有理数')) fail('zh not restored after switching back')
await page.screenshot({ path: OUT + '07-zh-restored.png', fullPage: false })
console.log('OK: zh restored (full outline back)')

await browser.close()
console.log(process.exitCode ? '\n=== VERIFICATION FAILED ===' : '\n=== VERIFICATION PASSED ===')
