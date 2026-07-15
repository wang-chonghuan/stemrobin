import { Link, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { type OutlineSubject, parseLessonNumber, withAvailableLessonIds } from '~/lib/curriculum'
import { LOCALES, t, type Locale } from '~/lib/i18n'
import { setLocale } from '~/lib/locale'
import { logout, type CurrentUser } from '~/lib/session'

// The persistent left catalog: the curriculum outline (math + physics),
// collapsible by subject and stage. Lives in the _app layout so it stays mounted
// across navigation (outline open/closed state survives opening a lesson). The
// language switch lives in the header; picking a locale re-renders the whole
// shell (catalog + detail) in that language.
export function CatalogSidebar({
  lessonIds,
  locale,
  user,
  drawerOpen,
  onNavigate,
}: {
  lessonIds: string[]
  locale: Locale
  user: CurrentUser | null
  drawerOpen: boolean
  onNavigate: () => void
}) {
  const curriculum = withAvailableLessonIds(lessonIds, locale)
  return (
    <aside className={`sr-catalog${drawerOpen ? ' open' : ''}`}>
      <div className="sr-cat-head">
        <img
          className="sr-brand-img"
          src="/logo-mark.png"
          alt={locale === 'en' ? 'stemrobin' : '知更'}
          width={44}
          height={44}
        />
        <div>
          <span className="sr-brand-name">
            {locale === 'en' ? (
              'stemrobin'
            ) : (
              <>
                知<b>更</b>
              </>
            )}
          </span>
          {locale !== 'en' && (
            <span className="sr-tagline">{t(locale, 'brand.tagline')}</span>
          )}
        </div>
        <LanguageSwitch locale={locale} />
      </div>

      <div className="sr-cat-scroll">
        <div className="sr-cat-group">{t(locale, 'cat.group.curriculum')}</div>
        {curriculum.map((subj) => (
          <SubjectOutline
            key={subj.subject}
            subj={subj}
            locale={locale}
            defaultOpen={subj.subject === 'math'}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <LogoutFooter user={user} locale={locale} />
    </aside>
  )
}

// Persistent logout control in the catalog footer. Shows the signed-in email and
// a logout button that clears the HMAC session (existing `logout` server fn) and
// returns to the bare /login page.
function LogoutFooter({ user, locale }: { user: CurrentUser | null; locale: Locale }) {
  const router = useRouter()
  if (!user) return null
  async function signOut() {
    await logout()
    router.navigate({ to: '/login' })
  }
  return (
    <div className="sr-cat-foot">
      <span className="sr-cat-user" title={user.email}>
        {user.email}
      </span>
      <button type="button" className="sr-logout" onClick={signOut}>
        <LogOut size={15} aria-hidden />
        {t(locale, 'login.logout')}
      </button>
    </div>
  )
}

// Persistent 中 / EN segmented control. Sets the sr_locale cookie server-side,
// then invalidates the router so every loader re-runs and the whole app
// re-renders in the chosen language (no full page reload).
function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter()
  const labels: Record<Locale, string> = { zh: '中', en: 'EN' }
  async function pick(next: Locale) {
    if (next === locale) return
    await setLocale({ data: next })
    await router.invalidate()
  }
  return (
    <div className="sr-lang-switch" role="group" aria-label={t(locale, 'switch.aria')}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={'sr-lang-opt' + (l === locale ? ' active' : '')}
          aria-pressed={l === locale}
          onClick={() => pick(l)}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  )
}

function SubjectOutline({
  subj,
  locale,
  defaultOpen,
  onNavigate,
}: {
  subj: OutlineSubject
  locale: Locale
  defaultOpen: boolean
  onNavigate: () => void
}) {
  const total = subj.stages.reduce((n, s) => n + s.lessons.length, 0)
  const ready = subj.stages.reduce((n, s) => n + s.lessons.filter((l) => l.id).length, 0)
  return (
    <details className="sr-out-subject" open={defaultOpen}>
      <summary>
        <span className="sr-out-caret" aria-hidden />
        <span className="sr-out-subject-name">{subj.label}</span>
        <span className="sr-count">{ready > 0 ? `${ready}/${total}` : total}</span>
      </summary>
      {subj.stages.map((stage, i) => {
        const hasReady = stage.lessons.some((l) => l.id)
        // Stage number from a real lesson id when present, so a filtered locale
        // outline (untranslated stages dropped) keeps the true stage number.
        const readyId = stage.lessons.find((l) => l.id)?.id
        const stageNo = (readyId && parseLessonNumber(readyId)?.stage) || i + 1
        return (
          <details key={stage.title} className="sr-out-stage" open={hasReady}>
            <summary>
              <span className="sr-out-caret" aria-hidden />
              <span className="sr-out-stage-name">
                {t(locale, 'cat.stage', { n: stageNo, title: stage.title })}
              </span>
            </summary>
            <ul className="sr-out-lessons">
              {stage.lessons.map((l, j) => {
                const num = l.id ? parseLessonNumber(l.id) : null
                const label = num ? `${num.stage}.${num.order}` : `${stageNo}.${j + 1}`
                return l.id ? (
                  <li key={l.id}>
                    <Link
                      to="/lesson/$id"
                      params={{ id: l.id }}
                      className="sr-out-lesson ready"
                      activeProps={{ className: 'sr-out-lesson ready active' }}
                      onClick={onNavigate}
                    >
                      <span className="sr-out-dot" aria-hidden />
                      {label} {l.title}
                    </Link>
                  </li>
                ) : (
                  <li key={l.title} className="sr-out-lesson">
                    {label} {l.title}
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}
    </details>
  )
}
