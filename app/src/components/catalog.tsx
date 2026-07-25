import { Link, useRouter } from '@tanstack/react-router'
import { Check, ChevronUp, Languages, LogIn, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { EnglishLessonRef } from '~/lib/english'
import {
  bookLessons,
  getTextbookOutline,
  type OutlineDiscipline,
  type OutlineLesson,
} from '~/lib/textbooks'
import { LOCALES, t, type Locale } from '~/lib/i18n'
import { setLocale } from '~/lib/locale'
import { logout, type CurrentUser } from '~/lib/session'

// Language names are shown in their own language (self-referential), so they are
// not routed through the i18n table.
const LOCALE_NAME: Record<Locale, string> = { zh: '中文', en: 'English' }

// The persistent left catalog: the curriculum outline (math + physics),
// collapsible by subject and stage. Lives in the _app layout so it stays mounted
// across navigation (outline open/closed state survives opening a lesson). The
// language switch lives in the header; picking a locale re-renders the whole
// shell (catalog + detail) in that language.
export function CatalogSidebar({
  lessonIds,
  englishLessons,
  locale,
  user,
  drawerOpen,
  onNavigate,
}: {
  lessonIds: string[]
  englishLessons: EnglishLessonRef[]
  locale: Locale
  user: CurrentUser | null
  drawerOpen: boolean
  onNavigate: () => void
}) {
  const outline = getTextbookOutline(lessonIds, locale)
  return (
    <aside className={`sr-catalog${drawerOpen ? ' open' : ''}`}>
      <div className="sr-cat-head">
        <Link className="sr-brand-link" to="/" onClick={onNavigate} aria-label={t(locale, 'ov.title')}>
          <img
            className="sr-brand-img"
            src="/logo-mark.png"
            alt="LemmaDeck"
            width={44}
            height={44}
          />
          <div>
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
            <span className="sr-tagline">{t(locale, 'brand.tagline')}</span>
          </div>
        </Link>
      </div>

      <div className="sr-cat-scroll">
        <div className="sr-cat-group">{t(locale, 'cat.group.curriculum')}</div>
        {outline.map((d) => (
          <DisciplineOutline
            key={d.discipline}
            discipline={d}
            locale={locale}
            defaultOpen={d.discipline === 'math'}
            onNavigate={onNavigate}
          />
        ))}
        <EnglishOutline lessons={englishLessons} locale={locale} onNavigate={onNavigate} />
      </div>

      <UserMenu user={user} locale={locale} />
    </aside>
  )
}

// Sidebar account control: an avatar + name button that opens an upward popover
// with the language switch (folded in from the old header control) and logout.
// No display-name field exists (sr_users has only email), so the name is the
// email's local-part and the avatar is its first letter.
function UserMenu({ user, locale }: { user: CurrentUser | null; locale: Locale }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function pickLocale(next: Locale) {
    setOpen(false)
    if (next === locale) return
    await setLocale({ data: next })
    await router.invalidate()
  }

  // Open access (STEMROBIN-68): logged-out visitors see a prominent sign-in CTA
  // (browsing is free) plus the language switch, folded into a small globe popover.
  if (!user) {
    return (
      <div className="sr-usermenu sr-usermenu-guest" ref={rootRef}>
        {open && (
          <div className="sr-usermenu-pop" role="menu" aria-label={t(locale, 'switch.aria')}>
            <div className="sr-usermenu-section">
              <span className="sr-usermenu-label">
                <Languages size={13} aria-hidden /> {t(locale, 'switch.aria')}
              </span>
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="menuitemradio"
                  aria-checked={l === locale}
                  className={'sr-usermenu-item' + (l === locale ? ' active' : '')}
                  onClick={() => pickLocale(l)}
                >
                  <span>{LOCALE_NAME[l]}</span>
                  {l === locale && <Check size={15} aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}
        <Link to="/login" className="sr-usermenu-trigger sr-usermenu-login">
          <span className="sr-avatar" aria-hidden>
            <LogIn size={16} />
          </span>
          <span className="sr-usermenu-name">
            {t(locale, 'cat.login')}
            <small>{t(locale, 'cat.login.sub')}</small>
          </span>
        </Link>
        <button
          type="button"
          className="sr-usermenu-langbtn"
          aria-label={t(locale, 'switch.aria')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Languages size={16} aria-hidden />
        </button>
      </div>
    )
  }

  const name = user.email.split('@')[0]
  const initial = (name[0] || user.email[0] || '?').toUpperCase()

  async function signOut() {
    setOpen(false)
    await logout()
    router.navigate({ to: '/login' })
  }

  return (
    <div className="sr-usermenu" ref={rootRef}>
      {open && (
        <div className="sr-usermenu-pop" role="menu" aria-label={t(locale, 'account.menu')}>
          <div className="sr-usermenu-section">
            <span className="sr-usermenu-label">
              <Languages size={13} aria-hidden /> {t(locale, 'switch.aria')}
            </span>
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                className={'sr-usermenu-item' + (l === locale ? ' active' : '')}
                onClick={() => pickLocale(l)}
              >
                <span>{LOCALE_NAME[l]}</span>
                {l === locale && <Check size={15} aria-hidden />}
              </button>
            ))}
          </div>
          <div className="sr-usermenu-sep" />
          <button type="button" role="menuitem" className="sr-usermenu-item danger" onClick={signOut}>
            <LogOut size={15} aria-hidden /> {t(locale, 'login.logout')}
          </button>
        </div>
      )}
      <button
        type="button"
        className={'sr-usermenu-trigger' + (open ? ' open' : '')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={user.email}
      >
        <span className="sr-avatar" aria-hidden>{initial}</span>
        <span className="sr-usermenu-name">{name}</span>
        <ChevronUp size={16} className="sr-usermenu-caret" aria-hidden />
      </button>
    </div>
  )
}

// 短文学英语 (STEMROBIN-82). Its catalog is DB-driven rather than a static outline:
// the 84 A1A2 passages are generated, so their titles only exist once saved.
// Nothing is rendered until at least one lesson is in the DB — there is no static
// list to show placeholders against, unlike math/physics. Lessons are a flat,
// sequentially-numbered list (1, 2, 3 …), not grouped into units.
function EnglishOutline({
  lessons,
  locale,
  onNavigate,
}: {
  lessons: EnglishLessonRef[]
  locale: Locale
  onNavigate: () => void
}) {
  if (!lessons.length) return null
  return (
    <details className="sr-out-subject" open>
      <summary>
        <span className="sr-out-caret" aria-hidden />
        <span className="sr-out-subject-name">{t(locale, 'cat.english')}</span>
        <span className="sr-count">{lessons.length}</span>
      </summary>
      <details className="sr-out-stage" open>
        <summary>
          <span className="sr-out-caret" aria-hidden />
          <span className="sr-out-stage-name">A1A2</span>
        </summary>
        <ul className="sr-out-lessons">
          {lessons.map((l) => (
            <li key={l.id}>
              <Link
                to="/english/$id"
                params={{ id: l.id }}
                className="sr-out-lesson ready"
                activeProps={{ className: 'sr-out-lesson ready active' }}
                onClick={onNavigate}
              >
                <span className="sr-out-dot" aria-hidden />
                {l.seq}. {l.title}
              </Link>
            </li>
          ))}
        </ul>
      </details>
      {/* One math lesson from the retired outline is parked here as a worked
          sample of the card format (STEMROBIN-113). It is a reference, not part
          of the English course. */}
      <details className="sr-out-stage">
        <summary>
          <span className="sr-out-caret" aria-hidden />
          <span className="sr-out-stage-name">{t(locale, 'cat.ref')}</span>
        </summary>
        <ul className="sr-out-lessons">
          <li>
            <Link
              to="/lesson/$id"
              params={{ id: REFERENCE_LESSON }}
              className="sr-out-lesson ready"
              activeProps={{ className: 'sr-out-lesson ready active' }}
              onClick={onNavigate}
            >
              <span className="sr-out-dot" aria-hidden />
              {t(locale, `cat.ref.${REFERENCE_LESSON}`)}
            </Link>
          </li>
        </ul>
      </details>
    </details>
  )
}

const REFERENCE_LESSON = 'math-s10-02'

// One outline row, plus the book's own numbered items beneath it. A lesson links
// once the DB holds its id, and is plain text until then; the number is blank for
// entries the book leaves unnumbered. The topics are what the lesson is made of,
// not destinations, so they never link.
function LessonRow({
  lesson,
  title,
  onNavigate,
}: {
  lesson: OutlineLesson
  title: string
  onNavigate: () => void
}) {
  return (
    <li>
      {lesson.ready ? (
        <Link
          to="/lesson/$id"
          params={{ id: lesson.id }}
          className="sr-out-lesson ready"
          activeProps={{ className: 'sr-out-lesson ready active' }}
          onClick={onNavigate}
        >
          <span className="sr-out-dot" aria-hidden />
          {title}
        </Link>
      ) : (
        <span className="sr-out-lesson">{title}</span>
      )}
      {lesson.topics.length > 0 && (
        <ol className="sr-out-topics">
          {lesson.topics.map((tp) => (
            <li key={tp.number} className="sr-out-topic">
              <span className="sr-out-topic-n">{tp.number}</span>
              {tp.title}
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

const rowTitle = (l: OutlineLesson) => (l.number ? `${l.number} ${l.title}` : l.title)

// 学科 → 册 → 章 → 课. The book is the middle level (its title already carries
// the branch — "Algebra, Grade 6"), so the rail nests three deep, not four.
// Within a book it renders whatever `contents` holds: the printed first level
// mixes chapters with entries that are themselves a lesson, and the JSON says
// which is which.
function DisciplineOutline({
  discipline,
  locale,
  defaultOpen,
  onNavigate,
}: {
  discipline: OutlineDiscipline
  locale: Locale
  defaultOpen: boolean
  onNavigate: () => void
}) {
  const lessons = discipline.books.flatMap(bookLessons)
  const ready = lessons.filter((l) => l.ready).length
  return (
    <details className="sr-out-subject" open={defaultOpen}>
      <summary>
        <span className="sr-out-caret" aria-hidden />
        <span className="sr-out-subject-name">{discipline.label}</span>
        <span className="sr-count">{ready > 0 ? `${ready}/${lessons.length}` : lessons.length}</span>
      </summary>
      {discipline.books.map((book) => (
        <details key={book.book} className="sr-out-book" open={discipline.books.length === 1}>
          <summary>
            <span className="sr-out-caret" aria-hidden />
            <span className="sr-out-stage-name">{book.title}</span>
          </summary>
          {book.contents.map((node) =>
            node.kind === 'chapter' ? (
              <details
                key={node.id}
                className="sr-out-stage"
                open={node.lessons.some((l) => l.ready)}
              >
                <summary>
                  <span className="sr-out-caret" aria-hidden />
                  <span className="sr-out-stage-name">{node.label}</span>
                </summary>
                <ul className="sr-out-lessons">
                  {node.lessons.map((l) => (
                    <LessonRow
                      key={l.id}
                      lesson={l}
                      title={rowTitle(l)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              </details>
            ) : (
              <ul key={node.lesson.id} className="sr-out-lessons sr-out-toplevel">
                <LessonRow
                  lesson={node.lesson}
                  title={rowTitle(node.lesson)}
                  onNavigate={onNavigate}
                />
              </ul>
            ),
          )}
        </details>
      ))}
    </details>
  )
}
