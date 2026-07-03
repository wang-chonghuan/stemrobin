import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { login } from '~/lib/session'

export const Route = createFileRoute('/_app/login')({
  component: LoginView,
})

function LoginView() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await login({ data: { email, password } })
      if ('error' in r) {
        setError(r.error)
      } else {
        router.navigate({ to: '/' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <span className="sr-d-title">登录</span>
      </div>
      <div className="sr-d-scroll">
        <form className="sr-login" onSubmit={submit}>
          <p className="sr-login-lead">登录后可保存你的答题记录。</p>
          <label className="sr-login-field">
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="sr-login-field">
            <span>密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="sr-login-error">{error}</p>}
          <button type="submit" className="sr-btn" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </main>
  )
}
