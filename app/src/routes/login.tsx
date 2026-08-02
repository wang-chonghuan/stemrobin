import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { BrandMark } from '~/components/brand-mark'
import { getCurrentUser, login, registerEmail } from '~/lib/session'
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
    if (user) throw redirect({ to: '/learn' })
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
  const [registrationEmail, setRegistrationEmail] = useState('')
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const [registrationBusy, setRegistrationBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await login({ data: { email, password } })
      if ('error' in r) {
        setError(r.error)
      } else {
        router.navigate({ to: '/learn' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault()
    setRegistrationBusy(true)
    setRegistrationError(null)
    setRegistrationMessage(null)
    try {
      const result = await registerEmail({ data: { email: registrationEmail } })
      if ('error' in result) {
        setRegistrationError(
          t(
            locale,
            result.error === 'invalid_email'
              ? 'login.register.invalid'
              : 'login.register.error',
          ),
        )
      } else {
        setRegistrationMessage(t(locale, 'login.register.success'))
      }
    } finally {
      setRegistrationBusy(false)
    }
  }

  return (
    <main className="sr-auth">
      <div className="sr-auth-card">
        <div className="sr-auth-brand">
          <BrandMark className="sr-brand-img" />
          <span className={'sr-brand-name' + (locale === 'en' ? '' : ' sr-brand-name-zh')}>
            {locale === 'en' ? (
              <>
                Lemma<b>Deck</b>
              </>
            ) : (
              <>
                引理<b>阶梯</b>
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
        <div className="sr-auth-divider" aria-hidden>
          <span />
        </div>
        <form className="sr-register" onSubmit={register}>
          <p className="sr-register-lead">{t(locale, 'login.register.prompt')}</p>
          <label className="sr-login-field">
            <span>{t(locale, 'login.email')}</span>
            <input
              type="email"
              autoComplete="email"
              value={registrationEmail}
              onChange={(e) => setRegistrationEmail(e.target.value)}
              required
            />
          </label>
          {registrationError && (
            <p className="sr-login-error" role="alert">{registrationError}</p>
          )}
          {registrationMessage && (
            <p className="sr-register-success" role="status">{registrationMessage}</p>
          )}
          <button
            type="submit"
            className="sr-btn ghost sr-register-submit"
            disabled={registrationBusy}
          >
            {registrationBusy
              ? t(locale, 'login.register.submitting')
              : t(locale, 'login.register.submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
