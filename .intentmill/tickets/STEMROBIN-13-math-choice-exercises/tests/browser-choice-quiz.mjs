import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { chromium } from '../../../../app/node_modules/playwright/index.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3001'
const screenshots = resolve(
  '.intentmill/tickets/STEMROBIN-13-math-choice-exercises/tests/screenshots',
)
const userId = Number(process.env.STEMROBIN_TEST_USER_ID ?? '2')
const sessionSecret =
  process.env.SESSION_SECRET ?? 'stemrobin-dev-session-secret'

if (!Number.isInteger(userId)) throw new Error('STEMROBIN_TEST_USER_ID must be an integer')

mkdirSync(screenshots, { recursive: true })

function sessionValue(id) {
  const signature = crypto
    .createHmac('sha256', sessionSecret)
    .update(String(id))
    .digest('hex')
  return `${id}.${signature}`
}

async function contextFor(browser, viewport, authenticated = true) {
  const context = await browser.newContext({ viewport })
  if (!authenticated) return context
  const { hostname } = new URL(baseUrl)
  await context.addCookies([
    {
      name: 'sr_session',
      value: sessionValue(userId),
      domain: hostname,
      path: '/',
    },
  ])
  return context
}

async function openFiveOptionCard(page) {
  const drawer = page.getByRole('dialog', { name: '卡片答题' })
  const next = drawer.getByRole('button', { name: '下一题', exact: true })
  await drawer.locator('.sr-quiz-options').first().waitFor()

  for (let i = 0; i < 20; i++) {
    const options = drawer.locator('.sr-quiz-opt')
    if ((await options.count()) >= 5) return { drawer, options }
    assert.equal(await next.isEnabled(), true, 'expected a five-option math card')
    await next.evaluate((button) => button.click())
    await page.waitForTimeout(50)
  }
  throw new Error('No five-option card found in math-s3-01')
}

async function openStoryWorkCard(page) {
  const drawer = page.getByRole('dialog', { name: '卡片答题' })
  await drawer.locator('.sr-quiz-card').waitFor()
  const next = drawer.getByRole('button', { name: '下一题', exact: true })

  for (let i = 0; i < 14; i++) {
    if (await drawer.locator('.sr-quiz-work').count()) return drawer
    assert.equal(await next.isEnabled(), true, 'expected a work-mode story card')
    await next.evaluate((button) => button.click())
    await page.waitForTimeout(50)
  }
  throw new Error('No work-mode story card found in ford-c01')
}

const browser = await chromium.launch({ channel: 'chrome', headless: false })
try {
  const desktop = await contextFor(browser, { width: 1440, height: 1000 })
  const page = await desktop.newPage()
  const serverPayloads = []
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'fetch') return
    try {
      serverPayloads.push(await response.text())
    } catch {
      // Ignore streaming responses that the browser has already consumed.
    }
  })

  await page.goto(`${baseUrl}/lesson/math-s3-01`, { waitUntil: 'networkidle' })
  const frame = page.frameLocator('iframe')
  await frame.locator('ol.sr-practice').waitFor()
  const embeddedOptionCounts = await frame
    .locator('ol.sr-practice > li')
    .evaluateAll((items) => items.map((item) => item.querySelectorAll('.sr-p-opt').length))
  assert.equal(embeddedOptionCounts.every((count) => count >= 3), true)
  assert.equal(embeddedOptionCounts.some((count) => count >= 5), true)
  await frame
    .locator('section[data-sr-section="practice"]')
    .screenshot({ path: resolve(screenshots, 'practice-desktop.png') })

  await page.getByRole('button', { name: '卡片答题' }).click()
  const { drawer, options } = await openFiveOptionCard(page)
  await drawer.waitFor()
  assert.equal(await options.count() >= 5, true)
  assert.equal(
    await drawer.locator('.sr-quiz-feedback').count(),
    0,
    'answer explanation must stay hidden before a selection',
  )
  await page.waitForTimeout(250)
  const questionPayloads = serverPayloads.filter(
    (payload) => payload.includes('answerMode') && payload.includes('options'),
  )
  assert.equal(questionPayloads.length > 0, true, 'expected the lesson question payload')
  for (const payload of questionPayloads) {
    assert.equal(/correctIndex|correct_index|accept|"answer"\s*:/.test(payload), false)
  }

  await options.first().click()
  await drawer.locator('.sr-quiz-verdict').waitFor()
  assert.equal(await drawer.locator('.sr-quiz-feedback').count(), 1)
  await drawer
    .getByRole('button', { name: '结束本课答题', exact: true })
    .click()
  await drawer.getByText('本次成绩', { exact: true }).waitFor()
  const scoreText = await drawer.locator('.sr-score').innerText()
  assert.match(scoreText, /答对\s+\d+\s*\/\s*20/)
  assert.equal(scoreText.includes('说理'), false)
  await drawer.screenshot({ path: resolve(screenshots, 'quiz-desktop.png') })
  await desktop.close()

  const mobile = await contextFor(browser, { width: 390, height: 844 })
  const mobilePage = await mobile.newPage()
  await mobilePage.goto(`${baseUrl}/lesson/math-s3-01`, { waitUntil: 'networkidle' })
  await mobilePage.getByRole('button', { name: '卡片答题' }).click()
  const mobileDialog = mobilePage.getByRole('dialog', { name: '卡片答题' })
  await mobileDialog.waitFor()
  await mobilePage.waitForTimeout(1000)
  await mobileDialog
    .getByRole('button', { name: '重新开始', exact: true })
    .click({ force: true })
  const { drawer: mobileDrawer, options: mobileOptions } = await openFiveOptionCard(mobilePage)
  assert.equal(await mobileOptions.count() >= 5, true)
  assert.equal(
    await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  )
  await mobileDrawer.screenshot({ path: resolve(screenshots, 'quiz-mobile.png') })
  await mobile.close()

  const story = await contextFor(browser, { width: 1440, height: 1000 })
  const storyPage = await story.newPage()
  await storyPage.goto(`${baseUrl}/story/ford-c01`, { waitUntil: 'networkidle' })
  await storyPage.getByRole('button', { name: '卡片答题' }).click()
  const storyDrawer = await openStoryWorkCard(storyPage)
  await storyDrawer.getByText('我说完了，看参考答案', { exact: true }).waitFor()
  assert.equal(
    await storyDrawer.getByRole('button', { name: '结束本课答题', exact: true }).count(),
    0,
  )
  await story.close()

  console.log('choice quiz browser checks passed')
} finally {
  await browser.close()
}
