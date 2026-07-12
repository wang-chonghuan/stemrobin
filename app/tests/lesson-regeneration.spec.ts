import { expect, test, type Locator, type Page } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function practiceShape(page: Page, id: string) {
  await page.goto(`${baseUrl}/lesson/${id}`)
  const frame = page.frameLocator('iframe')
  const practice = frame.locator('ol.sr-practice')
  await expect(practice).toBeVisible()
  const firstItem = practice.locator('li').first()
  return {
    count: await practice.locator('li').count(),
    listStyle: await practice.evaluate((element) => getComputedStyle(element).listStyleType),
    paddingLeft: await firstItem.evaluate((element) => getComputedStyle(element).paddingLeft),
    borderTop: await firstItem.evaluate((element) => getComputedStyle(element).borderTopWidth),
    badge: await firstItem.evaluate((element) => getComputedStyle(element, '::before').content),
  }
}

function lessonDocument(page: Page): Locator {
  return page.locator('iframe')
}

test('regenerated 3.1 follows the outline and uses the 2.7 practice treatment', async ({ page }, testInfo) => {
  await page.goto(`${baseUrl}/lesson/math-s3-01`)

  await expect(page.getByRole('link', { name: '3.1 未知数是什么' })).toBeVisible()
  const frame = page.frameLocator('iframe')
  await expect(frame.locator('h1.sr-l-title')).toHaveText('3.1 未知数是什么')
  await expect(frame.locator('ol.sr-practice > li')).toHaveCount(20)
  const optionCounts = await frame
    .locator('ol.sr-practice > li')
    .evaluateAll((items) => items.map((item) => item.querySelectorAll('.sr-p-opt').length))
  expect(optionCounts.every((count) => count >= 3)).toBe(true)
  expect(optionCounts.some((count) => count >= 5)).toBe(true)

  const html = await lessonDocument(page).evaluate(
    (element) => element.contentDocument?.documentElement.outerHTML ?? '',
  )
  expect(html).not.toMatch(/correct_index|accept|"answer"/)
  await frame
    .locator('section[data-sr-section="practice"]')
    .screenshot({ path: testInfo.outputPath('practice-3.1-desktop.png') })

  const lesson31 = await practiceShape(page, 'math-s3-01')
  const lesson27 = await practiceShape(page, 'math-s2-07')
  expect(lesson31).toEqual(lesson27)
})

test('regenerated 3.1 practice stays inside a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/lesson/math-s3-01`)

  const frame = page.frameLocator('iframe')
  await expect(frame.locator('ol.sr-practice')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await expect
    .poll(() =>
      lessonDocument(page).evaluate((element) => {
        const document = element.contentDocument
        return document != null && document.documentElement.scrollWidth <= document.defaultView!.innerWidth
      }),
    )
    .toBe(true)
  await frame
    .locator('section[data-sr-section="practice"]')
    .screenshot({ path: testInfo.outputPath('practice-3.1-mobile.png') })
})
