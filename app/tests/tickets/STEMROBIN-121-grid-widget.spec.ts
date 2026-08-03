import crypto from 'node:crypto'
import { test, expect, type BrowserContext, type Locator } from '@playwright/test'

// STEMROBIN-121 —— 工单级验收脚本。两条断言与工单的两条验收标准 1:1 对应。
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

// 网格的坐标→像素映射与组件一致（每格 30，边距 26，y 轴朝上）。
const CELL = 30
const PAD = 26

async function clickCell(ex: Locator, domain: { x: number[]; y: number[] }, x: number, y: number) {
  const svg = ex.locator('.sr-grid-svg')
  const box = await svg.boundingBox()
  if (!box) throw new Error('网格没有渲染')
  const vbWidth = (domain.x[1] - domain.x[0]) * CELL + PAD * 2
  const vbHeight = (domain.y[1] - domain.y[0]) * CELL + PAD * 2
  const scale = box.width / vbWidth
  const vx = PAD + (x - domain.x[0]) * CELL
  const vy = vbHeight - PAD - (y - domain.y[0]) * CELL
  await svg.click({ position: { x: vx * scale, y: vy * scale } })
}

test.describe('STEMROBIN-121 坐标网格题在图上点选作答', () => {
  test('AC1：标出给定坐标的题可以点选作答并得到对错判定', async ({ page, context }) => {
    await learner(context)
    await page.goto(`${BASE}/card/math5-c1-s2-n16?tab=ex`, { waitUntil: 'networkidle' })

    // 第 264 题「作坐标轴并标出 A(2,8)…P(-7,0)」——本工单之前它是不判对错的自由作答。
    const ex = page.locator('#ex-264')
    await ex.scrollIntoViewIfNeeded()
    await expect(ex.locator('.sr-grid-svg')).toBeVisible()
    // 八个待标点各有一个入口
    await expect(ex.locator('.sr-grid-chip')).toHaveCount(8)

    const domain = { x: [-8, 7], y: [-8, 9] }
    const targets: [string, number, number][] = [
      ['A', 2, 8], ['B', 3, -4], ['C', -4, 5], ['D', -3, -7],
      ['E', 0, 5], ['M', 0, -4], ['K', 6, 0], ['P', -7, 0],
    ]
    for (const [name, x, y] of targets) {
      await ex.locator('.sr-grid-chip', { hasText: new RegExp(`^${name}`) }).first().click()
      await clickCell(ex, domain, x, y)
    }
    await page.screenshot({ path: 'test-results/121-plotted.png' })

    await ex.locator('.sr-math-submit').click()
    // 这道题现在会给出对错判定（改动前它只有「我已完成，查看标准答案」）
    await expect(ex.locator('.sr-math-result.correct')).toBeVisible()
    await page.screenshot({ path: 'test-results/121-plot-correct.png' })
  })

  test('AC2：读坐标的题点错判错，并在图上同时显示所点位置与标准位置', async ({ page, context }) => {
    await learner(context)
    await page.goto(`${BASE}/card/math5-c1-s2-n16?tab=ex`, { waitUntil: 'networkidle' })

    // 第 265 题「求出 A,B,C,D 各点的坐标」，标准位置 A(2,4) B(-4,3) C(-2,-3) D(4,-4)。
    const ex = page.locator('#ex-265')
    await ex.scrollIntoViewIfNeeded()
    await expect(ex.locator('.sr-grid-svg')).toBeVisible()
    const domain = { x: [-6, 7], y: [-6, 7] }

    // 故意把 A 点错，其余点对 —— 两次答错才揭晓（STEMROBIN-119），所以提交两轮。
    const wrong: [string, number, number][] = [
      ['A', 5, 5], ['B', -4, 3], ['C', -2, -3], ['D', 4, -4],
    ]
    for (const round of [0, 1]) {
      for (const [name, x, y] of wrong) {
        await ex.locator('.sr-grid-chip', { hasText: new RegExp(`^${name}`) }).first().click()
        await clickCell(ex, domain, x, y)
      }
      await ex.locator('.sr-math-submit').click()
      await expect(ex.locator('.sr-math-result.incorrect')).toBeVisible()
      if (round === 0) {
        // 第一次答错不揭底（STEMROBIN-119）：文字答案和网格上的标准位置都还不出现。
        await expect(ex.locator('.sr-math-submit')).toBeVisible()
        expect(await ex.locator('.sr-math-standard').count()).toBe(0)
        expect(await ex.locator('.sr-grid-standard').count()).toBe(0)
      }
    }

    // 第二次答错后才收题 —— 等这个信号，否则断言会赶在第二次判分返回之前。
    await expect(ex.locator('.sr-math-standard')).toBeVisible()

    // 两次之后：网格上同时看得见自己点的位置与标准位置
    await expect(ex.locator('.sr-grid-placed').first()).toBeVisible()
    expect(await ex.locator('.sr-grid-standard').count()).toBe(4)
    await expect(ex.locator('.sr-grid-legend')).toBeVisible()
    await page.screenshot({ path: 'test-results/121-placed-vs-standard.png' })
  })
})
