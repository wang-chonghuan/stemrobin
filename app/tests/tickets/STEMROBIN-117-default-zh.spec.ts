import crypto from 'node:crypto'
import { test, expect, type BrowserContext } from '@playwright/test'

// STEMROBIN-117 —— 工单级验收脚本（express lane 的测试义务）。
// 两条断言与工单的两条验收标准 1:1 对应。
//
// 基址由 SR_BASE_URL 给出：worktree 的 dev server 与主 checkout 固定的 3200 冲突时换端口。
const BASE = process.env.SR_BASE_URL ?? 'http://localhost:3200'
const HOST = new URL(BASE).hostname

// /learn 需要登录。会话是一个 HMAC 签名的 cookie（见 app/src/lib/session.server.ts），
// 密钥在未配置时用源码里的开发默认值 —— 这里照同一规则铸一个测试会话，不涉及任何口令。
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'stemrobin-dev-session-secret'
const TEST_USER_ID = process.env.SR_TEST_USER_ID ?? '2'

function sessionCookie() {
  const mac = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(TEST_USER_ID)
    .digest('hex')
  return {
    name: 'sr_session',
    value: `${TEST_USER_ID}.${mac}`,
    domain: HOST,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
}

// 「未表达过语言偏好」= 没有 sr_locale cookie。清空后只放回会话，不放语言偏好。
async function freshLearner(context: BrowserContext) {
  await context.clearCookies()
  await context.addCookies([sessionCookie()])
}

test.describe('STEMROBIN-117 默认界面语言改为中文', () => {
  test('AC1：清除 cookie 后落地页与学习首页都是中文', async ({ page, context }) => {
    await freshLearner(context)

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    // 落地页在移动抽屉里也放了一份同名 CTA（桌面宽度下隐藏），所以只取可见的那一个。
    await expect(page.getByText('免费开始学习').locator('visible=true').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/117-landing-zh.png' })

    await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' })
    expect(new URL(page.url()).pathname).toBe('/learn')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.getByText('课程大纲').first()).toBeVisible()
    await expect(page.getByText('学习情况').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/117-learn-zh.png' })
  })

  test('AC2：切到英文后保持英文；再清 cookie 回到中文', async ({ page, context }) => {
    await freshLearner(context)
    await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' })

    // 走界面上的语言菜单，而不是直接写 cookie —— 要验的是切换链路本身仍然有效。
    await page.locator('.sr-langmenu-btn').click()
    await page.locator('.sr-langmenu-pop button', { hasText: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByText('Learning stats').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/117-learn-en-persisted.png' })

    // 清掉偏好后重新打开：回到默认中文
    await freshLearner(context)
    await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.getByText('学习情况').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/117-learn-back-to-zh.png' })
  })
})
