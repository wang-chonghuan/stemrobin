// The landing page, glass edition. Positioning (2026-07 rewrite): a complete,
// human-ordered curriculum in the classic Soviet tradition, with AI confined to
// teaching — explanation, diagnosis, practice, review. The page answers, in
// order: what this is → how far it reaches → why it is not AI slop → how you
// learn → where the tradition comes from → what it covers → try it now → what
// is free → FAQ → final call.
//
// Live controls: the Curriculum map mega-dropdown (Explore/See the map open the
// same panel), Sign in, "open a random unit", the galaxy's search / discipline
// filter / zoom, the language toggle, and the tablet drawer. The rest is copy.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GitBranch,
  Layers,
  Lightbulb,
  Maximize2,
  Menu,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import {
  KnowledgeGalaxy,
  type GalaxyApi,
  type GalaxyFilter,
} from '~/components/knowledge-galaxy'
import { bookLessons, getTextbookOutline } from '~/lib/textbooks'
import { listAvailableLessonIds } from '~/lib/lessons'
import { getLocale, setLocale } from '~/lib/locale'
import { LANDING_COPY } from '~/lib/landing-copy'

export const Route = createFileRoute('/')({
  component: Landing,
  loader: async () => ({
    locale: await getLocale(),
    lessonIds: await listAvailableLessonIds(),
  }),
})


const FEATURE_ICONS = [Layers, Network, ClipboardCheck, Brain]
const PATH_ICONS = [GitBranch, BookOpen, BarChart3]
const STEP_ICONS = [BookOpen, ClipboardCheck, Lightbulb, RefreshCw]
const FILTERS: GalaxyFilter[] = ['all', 'math', 'physics', 'cross']

function Landing() {
  const { locale, lessonIds } = Route.useLoaderData()
  const router = useRouter()
  const t = LANDING_COPY[locale]
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GalaxyFilter>('all')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const navRef = useRef<HTMLElement>(null)
  const galaxyRef = useRef<GalaxyApi | null>(null)

  const outline = getTextbookOutline(lessonIds, locale)
  const readyIds = useMemo(
    () =>
      outline.flatMap((d) =>
        d.books.flatMap((b) => bookLessons(b).filter((l) => l.ready).map((l) => l.id)),
      ),
    [outline],
  )

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  async function switchLocale() {
    await setLocale({ data: locale === 'zh' ? 'en' : 'zh' })
    await router.invalidate()
  }

  function pickFilter(f: GalaxyFilter) {
    setFilter(f)
    galaxyRef.current?.setFilter(f)
  }

  // Random pick happens on click, never during render — SSR and hydration must
  // agree on the markup.
  function openRandomUnit() {
    if (!readyIds.length) return
    const id = readyIds[Math.floor(Math.random() * readyIds.length)]
    router.navigate({ to: '/lesson/$id', params: { id } })
  }

  const q = query.trim().toLowerCase()
  const matches =
    q && galaxyRef.current
      ? galaxyRef.current.stars
          .map((star, index) => ({ star, index }))
          .filter(
            ({ star }) =>
              star.title.toLowerCase().includes(q) ||
              (star.titleEn ?? '').toLowerCase().includes(q),
          )
          .slice(0, 8)
      : []

  const curriculumColumns = outline.map((d) => (
    <div key={d.discipline} className="lp-mega-col">
      <div className={'lp-mega-head ' + d.discipline}>{d.label}</div>
      {d.books.map((b) => {
        const ready = bookLessons(b).filter((l) => l.ready)
        const first = ready[0]
        return first ? (
          <Link
            key={b.book}
            to="/lesson/$id"
            params={{ id: first.id }}
            className="lp-mega-item"
            onClick={() => {
              setMenuOpen(false)
              setNavOpen(false)
            }}
          >
            <span>{b.title}</span>
            <small>{t.ready(ready.length)}</small>
          </Link>
        ) : (
          <div key={b.book} className="lp-mega-item off">
            <span>{b.title}</span>
            <small>{t.comingSoon}</small>
          </div>
        )
      })}
    </div>
  ))

  return (
    <div className="lp-page">
      <div className="lp-bg" aria-hidden />

      {/* Tablet / phone navigation: a drawer holding what the top bar drops. */}
      <button
        type="button"
        className={'lp-scrim' + (navOpen ? ' show' : '')}
        aria-label={t.closeMenu}
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />
      <aside className={'lp-drawer' + (navOpen ? ' open' : '')} aria-hidden={!navOpen}>
        <nav className="lp-drawer-links">
          <button type="button">{t.navMap}</button>
          <button type="button">{t.navHow}</button>
          <button type="button">{t.navTradition}</button>
          <button type="button">{t.navPricing}</button>
        </nav>
        <div className="lp-drawer-books">{curriculumColumns}</div>
        <div className="lp-drawer-ctas">
          <button type="button" className="lp-btn ghost" onClick={switchLocale}>
            {t.langButton}
          </button>
          <Link to="/login" className="lp-btn ghost" onClick={() => setNavOpen(false)}>
            {t.signIn}
          </Link>
          <Link to="/login" className="lp-btn solid" onClick={() => setNavOpen(false)}>
            {t.startFree}
            <Sparkles size={14} aria-hidden />
          </Link>
        </div>
      </aside>

      <div className="lp-shell">
        <header className="lp-nav" ref={navRef}>
          <Link to="/" className="lp-brand">
            <img src="/logo-mark.png" alt="" width={34} height={34} />
            <span className="lp-brand-name">
              Lemma<em>Deck</em>
              <small>{t.tagline}</small>
            </span>
          </Link>
          <nav className="lp-nav-links">
            <button
              type="button"
              className={'lp-nav-link dropdown' + (menuOpen ? ' open' : '')}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {t.navMap}
              <ChevronDown size={14} aria-hidden />
            </button>
            <button type="button" className="lp-nav-link">
              {t.navHow}
            </button>
            <button type="button" className="lp-nav-link">
              {t.navTradition}
            </button>
            <button type="button" className="lp-nav-link">
              {t.navPricing}
            </button>
          </nav>
          <div className="lp-nav-actions">
            <button type="button" className="lp-lang" onClick={switchLocale}>
              {t.langButton}
            </button>
            <Link to="/login" className="lp-btn ghost">
              {t.signIn}
            </Link>
            <Link to="/login" className="lp-btn solid">
              {t.startFree}
              <Sparkles size={14} aria-hidden />
            </Link>
          </div>
          {/* Below the desktop breakpoint everything folds into the drawer. */}
          <button
            type="button"
            className="lp-burger"
            aria-label={navOpen ? t.closeMenu : t.openMenu}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {menuOpen && (
            <div className="lp-mega" role="menu">
              {curriculumColumns}
            </div>
          )}
        </header>

        {/* ---------- hero ---------- */}
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-badge">
              <Sparkles size={13} aria-hidden />
              {t.badge}
            </span>
            <h1>
              {t.h1pre}
              <em>{t.h1accent}</em>
              {t.h1post}
            </h1>
            <p className="lp-hero-body">{t.heroBody}</p>
            <p className="lp-hero-body">{t.heroTrust}</p>
            <div className="lp-ctas">
              <Link to="/login" className="lp-btn solid lg">
                {t.startFree}
                <Sparkles size={15} aria-hidden />
              </Link>
              <button type="button" className="lp-btn ghost lg" onClick={() => setMenuOpen(true)}>
                {t.exploreCurriculum} →
              </button>
            </div>
            <p className="lp-hero-micro">{t.heroMicro}</p>
          </div>

        </section>

        {/* ---------- the map + "curriculum first" ---------- */}
        <section className="lp-bottom">
          <div className="lp-universe-card">
            <div className="lp-universe-head">
              <div className="lp-universe-titles">
                <h2>{t.universeTitle}</h2>
                <p>{t.universeSub}</p>
              </div>
              <div className="lp-universe-tools">
                <div className="lp-search">
                  <Search size={14} aria-hidden />
                  <input
                    type="search"
                    value={query}
                    placeholder={t.searchPlaceholder}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t.searchPlaceholder}
                  />
                  {matches.length > 0 && (
                    <div className="lp-search-pop" role="listbox">
                      {matches.map(({ star, index }) => (
                        <button
                          key={star.id}
                          type="button"
                          role="option"
                          aria-selected="false"
                          onClick={() => {
                            galaxyRef.current?.focusStar(index)
                            setQuery('')
                          }}
                        >
                          <span>
                            {locale === 'zh' ? star.title : (star.titleEn ?? star.title)}
                          </span>
                          <i className={star.discipline} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="lp-chips" role="tablist">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={filter === f}
                      className={'lp-chip' + (filter === f ? ' active' : '')}
                      onClick={() => pickFilter(f)}
                    >
                      {t.chips[f]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="lp-galaxy-frame">
              <KnowledgeGalaxy locale={locale} theme="dark" bare apiRef={galaxyRef} />
              <div className="lp-galaxy-zoom">
                <button type="button" aria-label={t.zoomIn} onClick={() => galaxyRef.current?.zoomBy(0.78)}>
                  <Plus size={15} />
                </button>
                <button type="button" aria-label={t.zoomOut} onClick={() => galaxyRef.current?.zoomBy(1.28)}>
                  <Minus size={15} />
                </button>
                <button type="button" aria-label={t.reset} onClick={() => galaxyRef.current?.resetView()}>
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <aside className="lp-rigor">
            <h2>{t.rigorTitle}</h2>
            <p className="lp-rigor-sub">{t.rigorSub}</p>
            <ul className="lp-why">
              {t.features.map((f, i) => {
                const Icon = FEATURE_ICONS[i]
                return (
                  <li key={f.title}>
                    <span className="lp-why-ico">
                      <Icon size={18} aria-hidden />
                    </span>
                    <span className="lp-why-txt">
                      <strong>{f.title}</strong>
                      <small>{f.body}</small>
                    </span>
                  </li>
                )
              })}
            </ul>
            <blockquote>
              <p>{t.quote}</p>
              <cite>{t.quoteBy}</cite>
            </blockquote>
          </aside>
        </section>

        {/* ---------- screen 1: the path ---------- */}
        <section className="lp-section">
          <div className="lp-section-head">
            <h2>{t.pathTitle}</h2>
            <p>{t.pathBody}</p>
          </div>
          <div className="lp-trio">
            {t.pathItems.map((it, i) => {
              const Icon = PATH_ICONS[i]
              return (
                <div key={it.title} className="lp-trio-item">
                  <span className="lp-why-ico">
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3>{it.title}</h3>
                  <p>{it.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------- screen 2: how you learn ---------- */}
        <section className="lp-section">
          <div className="lp-section-head">
            <h2>{t.howTitle}</h2>
          </div>
          <ol className="lp-steps">
            {t.howSteps.map((s, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <li key={s.title}>
                  <span className="lp-step-n">{i + 1}</span>
                  <span className="lp-why-ico">
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              )
            })}
          </ol>
          <p className="lp-section-close">{t.howClosing}</p>
        </section>

        {/* ---------- screen 3: the tradition ---------- */}
        <section className="lp-section">
          <div className="lp-section-head">
            <h2>{t.tradTitle}</h2>
            <p>{t.tradBody}</p>
          </div>
          <div className="lp-split">
            <div className="lp-split-col lp-stable">
              <h3>{t.tradFixedTitle}</h3>
              <ul>
                {t.tradFixed.map((x) => (
                  <li key={x}>
                    <CheckCircle2 size={14} aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-split-col lp-varies">
              <h3>{t.tradVariesTitle}</h3>
              <ul>
                {t.tradVaries.map((x) => (
                  <li key={x}>
                    <Sparkles size={14} aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="lp-section-close strong">{t.tradClosing}</p>
        </section>

        {/* ---------- screen 4: scope ---------- */}
        <section className="lp-section">
          <div className="lp-section-head">
            <h2>{t.scopeTitle}</h2>
            <p>{t.scopeBody}</p>
          </div>
          <div className="lp-chains">
            <div className="lp-chain math">
              <h3>{t.scopeMath}</h3>
              <ol>
                {t.scopeMathChain.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </div>
            <div className="lp-chain physics">
              <h3>{t.scopePhysics}</h3>
              <ol>
                {t.scopePhysicsChain.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="lp-section-cta">
            <button type="button" className="lp-btn solid" onClick={() => setMenuOpen(true)}>
              {t.scopeCta} →
            </button>
          </div>
        </section>

        {/* ---------- screen 5: try it ---------- */}
        <section className="lp-section try">
          <div className="lp-section-head">
            <h2>{t.tryTitle}</h2>
            <p>{t.tryBody}</p>
          </div>
          <div className="lp-section-cta">
            <button
              type="button"
              className="lp-btn solid lg"
              onClick={openRandomUnit}
              disabled={!readyIds.length}
            >
              {t.tryPrimary}
              <Sparkles size={15} aria-hidden />
            </button>
            <button type="button" className="lp-btn ghost lg" onClick={() => setMenuOpen(true)}>
              {t.trySecondary} →
            </button>
          </div>
          <p className="lp-section-micro">{t.tryMicro}</p>
        </section>

        {/* ---------- screen 6: what is free ---------- */}
        <section className="lp-section">
          <div className="lp-section-head">
            <h2>{t.planTitle}</h2>
          </div>
          <div className="lp-plans">
            <div className="lp-plan">
              <h3>{t.planFreeTitle}</h3>
              <ul>
                {t.planFree.map((x) => (
                  <li key={x}>
                    <CheckCircle2 size={14} aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-plan">
              <h3>{t.planAccountTitle}</h3>
              <ul>
                {t.planAccount.map((x) => (
                  <li key={x}>
                    <CheckCircle2 size={14} aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-plan lp-accent">
              <h3>{t.planAiTitle}</h3>
              <ul>
                {t.planAi.map((x) => (
                  <li key={x}>
                    <Sparkles size={14} aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lp-section-cta">
            <Link to="/login" className="lp-btn solid">
              {t.startFree}
              <Sparkles size={14} aria-hidden />
            </Link>
          </div>
          <p className="lp-section-micro">{t.planNote}</p>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="lp-section">
          <div className="lp-section-head">
            <h2>{t.faqTitle}</h2>
          </div>
          <div className="lp-faq">
            {t.faq.map((f, i) => (
              <div key={f.q} className={'lp-faq-item' + (openFaq === i ? ' open' : '')}>
                <button
                  type="button"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{f.q}</span>
                  <ChevronDown size={16} aria-hidden />
                </button>
                {openFaq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ---------- final call ---------- */}
        <section className="lp-final">
          <h2>{t.finalTitle}</h2>
          <p>{t.finalBody}</p>
          <div className="lp-section-cta">
            <Link to="/login" className="lp-btn onband lg">
              {t.startFree}
              <Sparkles size={15} aria-hidden />
            </Link>
            <button type="button" className="lp-btn ghost lg" onClick={() => setMenuOpen(true)}>
              {t.finalSecondary} →
            </button>
          </div>
          <p className="lp-final-micro">{t.heroMicro}</p>
        </section>
      </div>
    </div>
  )
}
