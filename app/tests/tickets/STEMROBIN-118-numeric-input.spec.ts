import crypto from 'node:crypto'
import { test, expect, type BrowserContext } from '@playwright/test'

// STEMROBIN-118 —— 工单级验收脚本（express lane 的测试义务）。
// 两条断言与工单的两条验收标准 1:1 对应。
const BASE = process.env.SR_BASE_URL ?? 'http://localhost:3200'
const HOST = new URL(BASE).hostname
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'stemrobin-dev-session-secret'
const TEST_USER_ID = process.env.SR_TEST_USER_ID ?? '2'

function sessionCookie() {
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(TEST_USER_ID).digest('hex')
  return {
    name: 'sr_session',
    value: `${TEST_USER_ID}.${mac}`,
    domain: HOST,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
}

async function learner(context: BrowserContext) {
  await context.clearCookies()
  await context.addCookies([sessionCookie()])
}

test.describe('STEMROBIN-118 数值题改用数字输入并标注小问', () => {
  test('AC1：移动端数字题用数字键盘作答，判分与改动前一致', async ({ page, context }) => {
    await learner(context)
    await page.setViewportSize({ width: 390, height: 844 })
    // 第 13 课「绝对值」。第 205 题「已知 |a|=7，|-a| 等于几？」是单小问纯数值题。
    await page.goto(`${BASE}/card/math5-c1-s2-n13?tab=ex`, { waitUntil: 'networkidle' })

    const ex = page.locator('#ex-205')
    await ex.scrollIntoViewIfNeeded()

    // 作答框是原生输入而不是公式编辑器
    const blank = ex.locator('input.sr-num-field').first()
    await expect(blank).toBeVisible()
    await expect(blank).toHaveAttribute('inputmode', 'decimal')
    expect(await ex.locator('math-field').count()).toBe(0)

    // 点进去不应该弹出 MathLive 的虚拟键盘
    await blank.click()
    await page.waitForTimeout(600)
    const mathKeyboardVisible = await page.evaluate(() => {
      const kb = document.querySelector('.ML__keyboard')
      if (!kb) return false
      return getComputedStyle(kb as HTMLElement).visibility !== 'hidden'
    })
    expect(mathKeyboardVisible).toBe(false)
    await page.screenshot({ path: 'test-results/118-mobile-number-pad.png' })

    // 正确答案判对
    await blank.fill('7')
    await ex.locator('.sr-math-submit').click()
    await expect(ex.locator('.sr-math-result.correct')).toBeVisible()
    await page.screenshot({ path: 'test-results/118-correct.png' })

    // 错误答案判错（另一道题，因为答过的会锁住）
    const exWrong = page.locator('#ex-201')
    await exWrong.scrollIntoViewIfNeeded()
    const blanks = exWrong.locator('input.sr-num-field')
    expect(await blanks.count()).toBe(4)
    for (let i = 0; i < 4; i++) await blanks.nth(i).fill('999')
    await exWrong.locator('.sr-math-submit').click()
    await expect(exWrong.locator('.sr-math-result.incorrect')).toBeVisible()
    await page.screenshot({ path: 'test-results/118-wrong.png' })

    // 负数答案：数字键盘没有减号，靠正负号按钮补。第 203 题第一小问答案是 -25。
    const exNeg = page.locator('#ex-203')
    await exNeg.scrollIntoViewIfNeeded()
    const negBlank = exNeg.locator('input.sr-num-field').first()
    await negBlank.fill('25')
    await exNeg.locator('.sr-math-answer-head button').first().click()
    await expect(negBlank).toHaveValue('-25')
    await page.screenshot({ path: 'test-results/118-sign-toggle.png' })
  })

  test('AC2：多小问的每个作答框都带自己的小问标签与单位', async ({ page, context }) => {
    await learner(context)

    // 第 1 课第 2 题：答案键里小问名存的是旧字段 id（1/2/3），标签必须照样出得来。
    await page.goto(`${BASE}/card/math5-c1-s1-n1?tab=ex`, { waitUntil: 'networkidle' })
    const ex2 = page.locator('#ex-2')
    await ex2.scrollIntoViewIfNeeded()
    const labels2 = await ex2.locator('.sr-math-answer-label').allInnerTexts()
    expect(labels2).toHaveLength(3)
    expect(labels2[0]).toContain('1')
    expect(labels2[1]).toContain('2')
    expect(labels2[2]).toContain('3')
    // 三个标签互不相同 —— 改动前它们全是「我的答案」
    expect(new Set(labels2).size).toBe(3)
    await page.screenshot({ path: 'test-results/118-n1-ex2-labels.png' })

    // 第 16 课第 262 题：八小问，标签是 M/K/P/N 的向右向上，单位「格」。
    await page.goto(`${BASE}/card/math5-c1-s2-n16?tab=ex`, { waitUntil: 'networkidle' })
    const ex262 = page.locator('#ex-262')
    await ex262.scrollIntoViewIfNeeded()
    const labels262 = await ex262.locator('.sr-math-answer-label').allInnerTexts()
    expect(labels262).toHaveLength(8)
    expect(labels262[0]).toContain('M 向右')
    expect(labels262[1]).toContain('M 向上')
    expect(labels262[7]).toContain('N 向上')
    expect(new Set(labels262).size).toBe(8)
    // 单位显示在框旁，学习者不必输入它
    expect(await ex262.locator('.sr-math-unit').count()).toBe(8)
    expect(labels262[0]).toContain('格')
    await page.screenshot({ path: 'test-results/118-n16-ex262-labels.png' })
  })
})
