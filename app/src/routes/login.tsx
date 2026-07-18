import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { getCurrentUser, login } from '~/lib/session'
import { getLocale } from '~/lib/locale'
import { t } from '~/lib/i18n'

// Bare login page. Deliberately a TOP-LEVEL route (sibling of the gated `_app`
// layout), so a logged-out visitor sees only this login card — no catalog
// sidebar, no lesson titles, no other protected content. The `_app` auth gate
// (STEMROBIN-31) still protects every other surface; this page is the one public
// route. An already-authenticated visitor is bounced to the app.
export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (user) throw redirect({ to: '/' })
  },
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
    <main className="sr-auth">
      <div className="sr-auth-card">
        <div className="sr-auth-brand">
          <img
            className="sr-brand-img"
            src="/logo-mark.png"
            alt="MynaTree"
            width={44}
            height={44}
          />
          <span className={'sr-brand-name' + (locale === 'en' ? '' : ' sr-brand-name-zh')}>
            {locale === 'en' ? (
              <>
                Myna<b>Tree</b>
              </>
            ) : (
              <>
                八个<b>树</b>
              </>
            )}
          </span>
        </div>
        <h1 className="sr-auth-title">{t(locale, 'login.title')}</h1>
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
          <button type="submit" className="sr-btn primary sr-login-submit" disabled={busy}>
            {busy ? t(locale, 'login.submitting') : t(locale, 'login.submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
