import { createServerFn } from '@tanstack/react-start'

import { sql } from '~/lib/db'
import {
  clearSessionCookie,
  currentUserId,
  setSessionCookie,
  verifyPassword,
} from '~/lib/session.server'

export type CurrentUser = { userId: number; email: string }

// GET current user (for the UI to show logged-in state / gate the quiz).
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentUser | null> => {
    const uid = currentUserId()
    if (uid == null) return null
    const rows = await sql()`
      select user_id, email from sr_users where user_id = ${uid}
    `
    if (!rows.length) return null
    return { userId: rows[0].user_id, email: rows[0].email }
  },
)

// POST login: verify email + password against sr_users, set the httpOnly cookie.
export const login = createServerFn({ method: 'POST' })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }): Promise<CurrentUser | { error: string }> => {
    const rows = await sql()`
      select user_id, email, password_hash from sr_users
      where email = ${data.email.trim().toLowerCase()}
    `
    if (!rows.length || !verifyPassword(data.password, rows[0].password_hash)) {
      return { error: '邮箱或密码不正确' }
    }
    setSessionCookie(rows[0].user_id)
    return { userId: rows[0].user_id, email: rows[0].email }
  })

// POST logout: clear the cookie.
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  clearSessionCookie()
  return { ok: true }
})
