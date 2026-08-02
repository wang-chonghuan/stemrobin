import { expect, test } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3200'
const scrollPane = '[data-scroll-restoration-id="app-detail"]'

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`new pages start at the top on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(`${baseUrl}/card/math5-c1-s2-n14`)
    await expect(page.locator(scrollPane)).toBeVisible()
    await page.waitForFunction(() => Boolean(history.state?.__TSR_key))
    await page.waitForTimeout(100)

    await page.locator(scrollPane).hover()
    await page.mouse.wheel(0, 700)
    await expect
      .poll(() => page.locator(scrollPane).evaluate((element) => element.scrollTop))
      .toBe(700)

    await page
      .locator('.sr-deck-act[href="/card/math5-c1-s2-n15"]')
      .evaluate((link: HTMLAnchorElement) => {
        link.click()
      })
    await expect(page).toHaveURL(/\/card\/math5-c1-s2-n15$/)
    await expect
      .poll(() => page.locator(scrollPane).evaluate((element) => element.scrollTop))
      .toBe(0)
  })
}
