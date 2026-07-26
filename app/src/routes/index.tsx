// The landing page, glass edition: the galaxy photograph runs full-bleed
// behind everything, and the UI floats over it as frosted white cards. Hero
// copy sits on the card's white side while the right half stays transparent to
// let the spiral galaxy shine through. The draggable knowledge galaxy keeps its
// DARK skin inside a light card; its search box, discipline filter chips and
// zoom buttons are page chrome here (external GalaxyApi), not component chrome.
//
// Live controls: Curriculum mega-dropdown (Explore curriculum opens the same),
// Sign in, galaxy search/filter/zoom, language toggle. The rest is display.

import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Atom,
  BarChart3,
  Brain,
  ChevronDown,
  FileText,
  Infinity as InfinityIcon,
  Layers,
  Lightbulb,
  Maximize2,
  Minus,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import {
  KnowledgeGalaxy,
  type GalaxyApi,
  type GalaxyFilter,
} from '~/components/knowledge-galaxy'
import { bookLessons, getTextbookOutline } from '~/lib/textbooks'
import { listAvailableLessonIds } from '~/lib/lessons'
import { getLocale, setLocale } from '~/lib/locale'
import type { Locale } from '~/lib/i18n'

export const Route = createFileRoute('/')({
  component: Landing,
  loader: async () => ({
    locale: await getLocale(),
    lessonIds: await listAvailableLessonIds(),
  }),
})

const S = {
  en: {
    tagline: 'The lemma to science',
    navCurriculum: 'Curriculum',
    navHow: 'How it works',
    navAbout: 'About',
    navPricing: 'Pricing',
    signIn: 'Sign in',
    startFree: 'Start free',
    badge: 'Built for curious minds',
    h1pre: 'Secondary math & physics, inspired by ',
    h1accent: 'the elite STEM syllabus',
    h1post: ' led by math legend Andrey Kolmogorov.',
    bullets: [
      'From arithmetic to calculus, from levers to atomic nucleus.',
      'Formatted into structured, high-repetition learning decks—guided by AI for true mastery.',
    ],
    exploreCurriculum: 'Explore curriculum',
    checks: [
      'Free to learn',
      '1,500+ concepts',
      '16,000+ original problems',
      'Unlimited explanations',
      'Endless similar practice',
    ],
    features: [
      { title: 'Structured decks', body: 'High-repetition decks built for durable understanding.' },
      { title: 'True concept dependency', body: 'Every idea is placed in a web of real mathematical logic.' },
      { title: 'Mastery tracking', body: 'Track progress, accuracy, and mastery across the universe.' },
      { title: 'AI-guided review', body: 'Smart scheduling surfaces what you need, exactly when you need it.' },
    ],
    universeTitle: 'Explore the concept universe',
    universeSub: 'Zoom, pan, and discover how everything connects.',
    searchPlaceholder: 'Search concepts…',
    chips: { all: 'All', math: 'Mathematics', physics: 'Physics', cross: 'Cross-links' },
    rigorTitle: 'Rigor. Clarity. Results.',
    rigorSub: 'Trusted by learners and parents who value depth, structure, and measurable progress.',
    quote:
      '“School mathematics, and even the beginnings of calculus, can be mastered by ordinary ability — given good guidance or good books.”',
    quoteBy: '— Andrey Kolmogorov',
    ready: (n: number) => `${n} lessons ready`,
    comingSoon: 'Coming soon',
    langButton: '中文',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    reset: 'Reset view',
  },
  zh: {
    tagline: '通往科学的引理',
    navCurriculum: '课程体系',
    navHow: '学习方法',
    navAbout: '关于',
    navPricing: '定价',
    signIn: '登录',
    startFree: '免费开始',
    badge: '为好奇心而生',
    h1pre: '中学数学与物理，源自数学家柯尔莫戈洛夫制定的',
    h1accent: '精英理科大纲',
    h1post: '。',
    bullets: [
      '从算术到微积分，从杠杆到原子核。',
      '编成结构化、高频复现的学习卡组——由 AI 带你真正掌握。',
    ],
    exploreCurriculum: '浏览课程',
    checks: [
      '免费学习',
      '1,500+ 知识点',
      '16,000+ 原创习题',
      '无限讲解',
      '无限同类题',
    ],
    features: [
      { title: '结构化卡组', body: '为持久理解而设计的高重复学习卡组。' },
      { title: '真实的概念依赖', body: '每个概念都置于真实数学逻辑的网络之中。' },
      { title: '掌握度追踪', body: '在整个宇宙中追踪进度、正确率与掌握度。' },
      { title: 'AI 引导复习', body: '智能调度让你在恰当的时刻复习恰当的内容。' },
    ],
    universeTitle: '探索概念宇宙',
    universeSub: '缩放、平移，发现万物如何相连。',
    searchPlaceholder: '搜索概念…',
    chips: { all: '全部', math: '数学', physics: '物理', cross: '跨学科连接' },
    rigorTitle: '严谨。清晰。成效。',
    rigorSub: '深受重视深度、结构与可见进步的学习者与家长信赖。',
    quote: '“中学数学，乃至微积分的基础，在良好的指导或优秀书籍的帮助下，普通的能力就足以掌握。”',
    quoteBy: '—— 安德烈·柯尔莫戈洛夫',
    ready: (n: number) => `${n} 节课已上线`,
    comingSoon: '即将上线',
    langButton: 'EN',
    zoomIn: '放大',
    zoomOut: '缩小',
    reset: '复位视角',
  },
} as const

const FEATURE_ICONS = [Layers, Network, BarChart3, Brain]
const CHECK_ICONS = [ShieldCheck, Atom, FileText, Lightbulb, InfinityIcon]
const FILTERS: GalaxyFilter[] = ['all', 'math', 'physics', 'cross']

function Landing() {
  const { locale, lessonIds } = Route.useLoaderData()
  const router = useRouter()
  const t = S[locale]
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GalaxyFilter>('all')
  const navRef = useRef<HTMLElement>(null)
  const galaxyRef = useRef<GalaxyApi | null>(null)

  const outline = getTextbookOutline(lessonIds, locale)

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

  async function switchLocale() {
    await setLocale({ data: locale === 'zh' ? 'en' : 'zh' })
    await router.invalidate()
  }

  function pickFilter(f: GalaxyFilter) {
    setFilter(f)
    galaxyRef.current?.setFilter(f)
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

  return (
    <div className="lp-page">
      <div className="lp-bg" aria-hidden />

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
              {t.navCurriculum}
              <ChevronDown size={14} aria-hidden />
            </button>
            <button type="button" className="lp-nav-link">
              {t.navHow}
            </button>
            <button type="button" className="lp-nav-link">
              {t.navAbout}
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
            <button type="button" className="lp-btn solid">
              {t.startFree}
              <Sparkles size={14} aria-hidden />
            </button>
          </div>

          {menuOpen && (
            <div className="lp-mega" role="menu">
              {outline.map((d) => (
                <div key={d.discipline} className="lp-mega-col">
                  <div className={'lp-mega-head ' + d.discipline}>{d.label}</div>
                  {d.books.map((b) => {
                    const lessons = bookLessons(b)
                    const ready = lessons.filter((l) => l.ready)
                    const first = ready[0]
                    return first ? (
                      <Link
                        key={b.book}
                        to="/lesson/$id"
                        params={{ id: first.id }}
                        className="lp-mega-item"
                        onClick={() => setMenuOpen(false)}
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
              ))}
            </div>
          )}
        </header>

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
            <ul className="lp-hero-points">
              {t.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="lp-ctas">
              <button type="button" className="lp-btn solid lg">
                {t.startFree}
                <Sparkles size={15} aria-hidden />
              </button>
              <button type="button" className="lp-btn ghost lg" onClick={() => setMenuOpen(true)}>
                {t.exploreCurriculum} →
              </button>
            </div>
            <ul className="lp-checks">
              {t.checks.map((c, i) => {
                const Icon = CHECK_ICONS[i]
                return (
                  <li key={c}>
                    <Icon size={14} aria-hidden />
                    {c}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

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

          {/* One card, plain rows inside — no cards nested in cards. */}
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
      </div>
    </div>
  )
}
