import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { login } from '~/lib/session'
import { getLocale } from '~/lib/locale'
import { t } from '~/lib/i18n'

export const Route = createFileRoute('/_app/login')({
  component: LoginView,
  loader: async () => ({ locale: await getLocale() }),
})

function LoginView() {
  const router = useRouter()
  const { locale } = Route.useLoaderData()
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
        <span className="sr-d-title">{t(locale, 'login.title')}</span>
      </div>
      <div className="sr-d-scroll">
        <form className="sr-login" onSubmit={submit}>
          <p className="sr-login-lead">{t(locale, 'login.lead')}</p>
          <label className="sr-login-field">
            <span>{t(locale, 'login.email')}</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="sr-login-field">
            <span>{t(locale, 'login.password')}</span>
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
            {busy ? t(locale, 'login.submitting') : t(locale, 'login.submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
