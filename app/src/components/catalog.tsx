import { Link } from '@tanstack/react-router'

import { CURRICULUM, type OutlineSubject } from '~/lib/curriculum'
import type { StoryCatalogEntry } from '~/lib/stories'

// The persistent left catalog: the full curriculum outline (math + physics),
// collapsible by subject and stage. Lives in the _app layout so it stays mounted
// across navigation (outline open/closed state survives opening a lesson).
export function CatalogSidebar({
  stories,
  drawerOpen,
  onNavigate,
}: {
  stories: StoryCatalogEntry[]
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
          <span className="sr-tagline">随时随地学理工</span>
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

        {stories.length > 0 && (
          <>
            <div className="sr-cat-group">名人传记</div>
            {stories.map((story) => (
              <StoryOutline key={story.id} story={story} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

function StoryChapterLink({
  c,
  onNavigate,
}: {
  c: StoryCatalogEntry['chapters'][number]
  onNavigate: () => void
}) {
  return (
    <li key={c.id}>
      <Link
        to="/story/$id"
        params={{ id: c.id }}
        className="sr-out-lesson ready"
        activeProps={{ className: 'sr-out-lesson ready active' }}
        onClick={onNavigate}
      >
        <span className="sr-out-dot" aria-hidden />
        {c.ord}. {c.title}
        {c.sectionStart != null && c.sectionEnd != null && (
          <span className="sr-out-sec">
            §{c.sectionStart}
            {c.sectionEnd !== c.sectionStart && `–${c.sectionEnd}`}
          </span>
        )}
        {c.status === 'draft' && (
          <span className="sr-tag" style={{ marginLeft: 6 }}>
            草稿
          </span>
        )}
      </Link>
    </li>
  )
}

function StoryOutline({
  story,
  onNavigate,
}: {
  story: StoryCatalogEntry
  onNavigate: () => void
}) {
  // Group chapters into 阶段 (stage). Chapters with a stage nest under it; if no
  // chapter has a stage, fall back to a flat chapter list.
  const staged = story.chapters.some((c) => c.stage)
  const stages = staged
    ? [...new Map(
        story.chapters
          .filter((c) => c.stage)
          .map((c) => [c.stage as string, { name: c.stage as string, ord: c.stageOrd ?? 0 }]),
      ).values()].sort((a, b) => a.ord - b.ord)
    : []

  return (
    <details className="sr-out-subject" open>
      <summary>
        <span className="sr-out-caret" aria-hidden />
        <span className="sr-out-subject-name">{story.title}</span>
        <span className="sr-count">{story.chapters.length}</span>
      </summary>
      {staged ? (
        stages.map((st) => (
          <details key={st.name} className="sr-out-stage" open>
            <summary>
              <span className="sr-out-caret" aria-hidden />
              <span className="sr-out-stage-name">{st.name}</span>
            </summary>
            <ul className="sr-out-lessons">
              {story.chapters
                .filter((c) => c.stage === st.name)
                .map((c) => (
                  <StoryChapterLink key={c.id} c={c} onNavigate={onNavigate} />
                ))}
            </ul>
          </details>
        ))
      ) : (
        <ul className="sr-out-lessons">
          {story.chapters.map((c) => (
            <StoryChapterLink key={c.id} c={c} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </details>
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
                      {i + 1}.{j + 1} {l.title}
                    </Link>
                  </li>
                ) : (
                  <li key={l.title} className="sr-out-lesson">
                    {i + 1}.{j + 1} {l.title}
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
