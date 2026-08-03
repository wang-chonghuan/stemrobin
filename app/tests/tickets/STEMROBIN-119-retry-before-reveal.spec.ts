import crypto from 'node:crypto'
import { test, expect, type BrowserContext } from '@playwright/test'

// STEMROBIN-119 —— 工单级验收脚本（express lane 的测试义务）。
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

test.describe('STEMROBIN-119 答错允许重试再揭晓标准答案', () => {
  // 第 13 课第 205 题「已知 |a|=7，|-a| 等于几？」，标准答案 7。
  test('AC1：第一次答错不给答案、可以改；改对后判对', async ({ page, context }) => {
    await learner(context)
    await page.goto(`${BASE}/card/math5-c1-s2-n13?tab=ex`, { waitUntil: 'networkidle' })

    const ex = page.locator('#ex-205')
    await ex.scrollIntoViewIfNeeded()
    const blank = ex.locator('input.sr-num-field').first()

    await blank.fill('999')
    await ex.locator('.sr-math-submit').click()

    // 判为答错
    await expect(ex.locator('.sr-math-result.incorrect')).toBeVisible()
    // 标准答案没有出现
    expect(await ex.locator('.sr-math-standard').count()).toBe(0)
    // 作答框仍可编辑，提交入口还在
    await expect(blank).not.toHaveAttribute('readonly', /.*/)
    await expect(ex.locator('.sr-math-submit')).toBeVisible()
    await page.screenshot({ path: 'test-results/119-first-wrong-no-answer.png' })

    // 改成正确答案再提交 → 判对，并照常展示标准答案
    await blank.fill('7')
    await ex.locator('.sr-math-submit').click()
    await expect(ex.locator('.sr-math-result.correct')).toBeVisible()
    await expect(ex.locator('.sr-math-standard')).toBeVisible()
    await page.screenshot({ path: 'test-results/119-corrected.png' })
  })

  // 第 13 课第 199 题：五小问，全部纯数值。
  test('AC2：连续两次答错后展开标准答案并停止收题', async ({ page, context }) => {
    await learner(context)
    await page.goto(`${BASE}/card/math5-c1-s2-n13?tab=ex`, { waitUntil: 'networkidle' })

    const ex = page.locator('#ex-199')
    await ex.scrollIntoViewIfNeeded()
    const blanks = ex.locator('input.sr-num-field')
    const n = await blanks.count()
    expect(n).toBeGreaterThan(1)

    async function submitAll(value: string) {
      for (let i = 0; i < n; i++) await blanks.nth(i).fill(value)
      await ex.locator('.sr-math-submit').click()
    }

    await submitAll('111')
    await expect(ex.locator('.sr-math-result.incorrect')).toBeVisible()
    expect(await ex.locator('.sr-math-standard').count()).toBe(0)

    await submitAll('222')
    await expect(ex.locator('.sr-math-result.incorrect')).toBeVisible()
    // 第二次答错：标准答案展开，且不再收题
    await expect(ex.locator('.sr-math-standard')).toBeVisible()
    expect(await ex.locator('.sr-math-submit').count()).toBe(0)
    await expect(blanks.first()).toHaveAttribute('readonly', /.*/)
    await page.screenshot({ path: 'test-results/119-second-wrong-reveals.png' })
  })
})
