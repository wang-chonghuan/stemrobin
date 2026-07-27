# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lesson-regeneration.spec.ts >> regenerated 3.1 follows the outline and uses the 2.7 practice treatment
- Location: tests/lesson-regeneration.spec.ts:24:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/lesson/math-s3-01
Call log:
  - navigating to "http://localhost:3000/lesson/math-s3-01", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: localhost
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test, type Locator, type Page } from '@playwright/test'
  2  | 
  3  | const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000'
  4  | 
  5  | async function practiceShape(page: Page, id: string) {
  6  |   await page.goto(`${baseUrl}/lesson/${id}`)
  7  |   const frame = page.frameLocator('iframe')
  8  |   const practice = frame.locator('ol.sr-practice')
  9  |   await expect(practice).toBeVisible()
  10 |   const firstItem = practice.locator('li').first()
  11 |   return {
  12 |     count: await practice.locator('li').count(),
  13 |     listStyle: await practice.evaluate((element) => getComputedStyle(element).listStyleType),
  14 |     paddingLeft: await firstItem.evaluate((element) => getComputedStyle(element).paddingLeft),
  15 |     borderTop: await firstItem.evaluate((element) => getComputedStyle(element).borderTopWidth),
  16 |     badge: await firstItem.evaluate((element) => getComputedStyle(element, '::before').content),
  17 |   }
  18 | }
  19 | 
  20 | function lessonDocument(page: Page): Locator {
  21 |   return page.locator('iframe')
  22 | }
  23 | 
  24 | test('regenerated 3.1 follows the outline and uses the 2.7 practice treatment', async ({ page }, testInfo) => {
> 25 |   await page.goto(`${baseUrl}/lesson/math-s3-01`)
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/lesson/math-s3-01
  26 | 
  27 |   await expect(page.getByRole('link', { name: '3.1 未知数是什么' })).toBeVisible()
  28 |   const frame = page.frameLocator('iframe')
  29 |   await expect(frame.locator('h1.sr-l-title')).toHaveText('3.1 未知数是什么')
  30 |   await expect(frame.locator('ol.sr-practice > li')).toHaveCount(20)
  31 |   const optionCounts = await frame
  32 |     .locator('ol.sr-practice > li')
  33 |     .evaluateAll((items) => items.map((item) => item.querySelectorAll('.sr-p-opt').length))
  34 |   expect(optionCounts.every((count) => count >= 3)).toBe(true)
  35 |   expect(optionCounts.some((count) => count >= 5)).toBe(true)
  36 | 
  37 |   const html = await lessonDocument(page).evaluate(
  38 |     (element) => element.contentDocument?.documentElement.outerHTML ?? '',
  39 |   )
  40 |   expect(html).not.toMatch(/correct_index|accept|"answer"/)
  41 |   await frame
  42 |     .locator('section[data-sr-section="practice"]')
  43 |     .screenshot({ path: testInfo.outputPath('practice-3.1-desktop.png') })
  44 | 
  45 |   const lesson31 = await practiceShape(page, 'math-s3-01')
  46 |   const lesson27 = await practiceShape(page, 'math-s2-07')
  47 |   expect(lesson31).toEqual(lesson27)
  48 | })
  49 | 
  50 | test('regenerated 3.1 practice stays inside a mobile viewport', async ({ page }, testInfo) => {
  51 |   await page.setViewportSize({ width: 390, height: 844 })
  52 |   await page.goto(`${baseUrl}/lesson/math-s3-01`)
  53 | 
  54 |   const frame = page.frameLocator('iframe')
  55 |   await expect(frame.locator('ol.sr-practice')).toBeVisible()
  56 |   await expect
  57 |     .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  58 |     .toBe(true)
  59 |   await expect
  60 |     .poll(() =>
  61 |       lessonDocument(page).evaluate((element) => {
  62 |         const document = element.contentDocument
  63 |         return document != null && document.documentElement.scrollWidth <= document.defaultView!.innerWidth
  64 |       }),
  65 |     )
  66 |     .toBe(true)
  67 |   await frame
  68 |     .locator('section[data-sr-section="practice"]')
  69 |     .screenshot({ path: testInfo.outputPath('practice-3.1-mobile.png') })
  70 | })
  71 | 
```