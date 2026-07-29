import { Link, useParams, useRouter } from '@tanstack/react-router'
import { ChevronUp, LogIn, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { EnglishLessonRef } from '~/lib/english'
import {
  bookLessons,
  getTextbookOutline,
  type OutlineDiscipline,
  type OutlineLesson,
} from '~/lib/textbooks'
import { t, type Locale } from '~/lib/i18n'
import { logout, type CurrentUser } from '~/lib/session'

// The persistent left catalog: the curriculum outline (maths, physics, English),
// collapsible at every level. Lives in the _app layout so it stays mounted across
// navigation — which is what lets an open chapter survive opening a card.
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
  // The card being read, so the rail can unfold the section holding it. Loose
  // params: this component is mounted for every route under _app, not just /card.
  const openCard = useParams({ strict: false }).id
  const { railRef, gripProps } = useRailWidth()
  return (
    <aside className={`sr-catalog${drawerOpen ? ' open' : ''}`} ref={railRef}>
      <div {...gripProps} />
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
            openCard={openCard}
            onNavigate={onNavigate}
          />
        ))}
        <EnglishOutline lessons={englishLessons} locale={locale} onNavigate={onNavigate} />
      </div>

      <UserMenu user={user} locale={locale} />
    </aside>
  )
}

const RAIL_MIN = 236
const RAIL_KEY = 'sr_rail_w'

// Drag the rail's right edge. The width is written as a custom property on the
// element rather than through React state, so a drag repaints without
// re-rendering the whole outline; CSS clamps it between the floor and 30vw. The
// chosen width is remembered, or a reload would undo the drag.
function useRailWidth() {
  const railRef = useRef<HTMLElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const saved = Number(localStorage.getItem(RAIL_KEY))
    if (saved >= RAIL_MIN) railRef.current?.style.setProperty('--sr-rail-w', `${saved}px`)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Capture is an optimisation — the window listeners below do the work.
    }
    setDragging(true)
    const left = rail.getBoundingClientRect().left
    const move = (ev: PointerEvent) => {
      rail.style.setProperty('--sr-rail-w', `${Math.max(RAIL_MIN, ev.clientX - left)}px`)
    }
    const up = () => {
      setDragging(false)
      // Store what the browser settled on, not what the pointer asked for: the
      // ceiling is a vw clamp that CSS applies, so the two differ at the top end.
      localStorage.setItem(RAIL_KEY, String(Math.round(rail.getBoundingClientRect().width)))
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return {
    railRef,
    gripProps: {
      className: 'sr-rail-grip' + (dragging ? ' dragging' : ''),
      onPointerDown,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
    },
  }
}

// Sidebar account control: an avatar + name button opening an upward popover with
// sign-out. No display-name field exists (sr_users has only email), so the name is
// the email's local-part and the avatar is its first letter.
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

  // Open access (STEMROBIN-68): logged-out visitors get a prominent sign-in CTA;
  // browsing is free. The language switch moved to the top bar (LocaleMenu).
  if (!user) {
    return (
      <div className="sr-usermenu sr-usermenu-guest" ref={rootRef}>
        <Link to="/login" className="sr-usermenu-trigger sr-usermenu-login">
          <span className="sr-avatar" aria-hidden>
            <LogIn size={16} />
          </span>
          <span className="sr-usermenu-name">
            {t(locale, 'cat.login')}
            <small>{t(locale, 'cat.login.sub')}</small>
          </span>
        </Link>
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

// One outline row. The rail follows a single rule: a row with children folds,
// The destination is always the lesson — one section, one 課文 document.
//
// This used to route into /card/$id, where a numbered section was a collapsible
// group that was "never a destination" and only its individual 小节 were
// reachable. That followed the old card tree; content is now one document per
// section, so the section itself is what you open, and its 小节 are places
// inside that document rather than separate destinations. The 小节 still list
// under the section for orientation, and each opens the same 課文.
//
// Rows stay expandable-but-inert until the section has content: an unread row
// that navigates to an empty page is worse than one that plainly cannot be
// clicked. The dot marks a section whose 課文 exists.
function LessonRow({
  lesson,
  title,
  openCard,
  onNavigate,
}: {
  lesson: OutlineLesson
  title: string
  /** The lesson being read, so its section is unfolded on arrival. */
  openCard: string | undefined
  onNavigate: () => void
}) {
  if (lesson.topics.length === 0) {
    if (!lesson.ready) {
      return (
        <li>
          <span className="sr-out-lesson">{title}</span>
        </li>
      )
    }
    return (
      <li>
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
      </li>
    )
  }
  return (
    <li>
      <details className="sr-out-section" open={lesson.id === openCard}>
        <summary>
          <span className="sr-out-caret" aria-hidden />
          {lesson.ready ? (
            // Inside <summary>, so stop the click from toggling the disclosure —
            // the caret is the toggle, the title is the destination.
            <Link
              to="/lesson/$id"
              params={{ id: lesson.id }}
              className="sr-out-lesson ready"
              activeProps={{ className: 'sr-out-lesson ready active' }}
              onClick={(e) => {
                e.stopPropagation()
                onNavigate()
              }}
            >
              <span className="sr-out-dot" aria-hidden />
              {title}
            </Link>
          ) : (
            <span className="sr-out-lesson">{title}</span>
          )}
        </summary>
        <ol className="sr-out-topics">
          {lesson.topics.map((tp) => (
            <li key={tp.id}>
              {lesson.ready ? (
                <Link
                  to="/lesson/$id"
                  params={{ id: lesson.id }}
                  className="sr-out-topic"
                  onClick={onNavigate}
                >
                  <span className="sr-out-topic-n">{tp.number}</span>
                  {tp.title}
                </Link>
              ) : (
                <span className="sr-out-topic">
                  <span className="sr-out-topic-n">{tp.number}</span>
                  {tp.title}
                </span>
              )}
            </li>
          ))}
        </ol>
      </details>
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
  openCard,
  onNavigate,
}: {
  discipline: OutlineDiscipline
  locale: Locale
  defaultOpen: boolean
  openCard: string | undefined
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
                // Open when it holds what is being read, so arriving by link or
                // reload does not leave the rail folded shut around you.
                open={node.lessons.some(
                  (l) =>
                    l.ready ||
                    l.id === openCard ||
                    l.topics.some((tp) => tp.id === openCard),
                )}
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
                      openCard={openCard}
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
                  openCard={openCard}
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
