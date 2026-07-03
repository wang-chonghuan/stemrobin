import { Link } from '@tanstack/react-router'

import { CURRICULUM, type OutlineSubject } from '~/lib/curriculum'

// The persistent left catalog: the full curriculum outline (math + physics),
// collapsible by subject and stage. Lives in the _app layout so it stays mounted
// across navigation (outline open/closed state survives opening a lesson).
export function CatalogSidebar({
  drawerOpen,
  onNavigate,
}: {
  drawerOpen: boolean
  onNavigate: () => void
}) {
  return (
    <aside className={`sr-catalog${drawerOpen ? ' open' : ''}`}>
      <div className="sr-cat-head">
        <img
          className="sr-brand-img"
          src="/logo-mark.png"
          alt="知更"
          width={44}
          height={44}
        />
        <div>
          <span className="sr-brand-name">
            知<b>更</b>
          </span>
          <span className="sr-tagline">培养未来的创造者</span>
        </div>
      </div>

      <div className="sr-cat-scroll">
        <div className="sr-cat-group">课程大纲</div>
        {CURRICULUM.map((subj) => (
          <SubjectOutline
            key={subj.subject}
            subj={subj}
            defaultOpen={subj.subject === 'math'}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </aside>
  )
}

function SubjectOutline({
  subj,
  defaultOpen,
  onNavigate,
}: {
  subj: OutlineSubject
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
        return (
          <details key={stage.title} className="sr-out-stage" open={hasReady}>
            <summary>
              <span className="sr-out-caret" aria-hidden />
              <span className="sr-out-stage-name">
                第 {i + 1} 阶段 · {stage.title}
              </span>
            </summary>
            <ul className="sr-out-lessons">
              {stage.lessons.map((l, j) =>
                l.id ? (
                  <li key={l.id}>
                    <Link
                      to="/lesson/$id"
                      params={{ id: l.id }}
                      className="sr-out-lesson ready"
                      activeProps={{ className: 'sr-out-lesson ready active' }}
                      onClick={onNavigate}
                    >
                      <span className="sr-out-dot" aria-hidden />
                      {j + 1}. {l.title}
                    </Link>
                  </li>
                ) : (
                  <li key={l.title} className="sr-out-lesson">
                    {j + 1}. {l.title}
                  </li>
                ),
              )}
            </ul>
          </details>
        )
      })}
    </details>
  )
}
