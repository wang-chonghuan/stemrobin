import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Layers, Menu } from 'lucide-react'

import { getChapterView, getStoryQuestions, recordStoryAnswer } from '~/lib/stories'
import { useLayoutStore } from '~/lib/layout-store'
import { QuizDrawer } from '~/components/quiz-drawer'

// One 名人传记 chapter: the body is stored as Markdown and rendered to HTML
// server-side (getChapterView), shown as prose in a styled reading container +
// the shared card-quiz over sr_story_questions. `$id` is the chapter id (e.g.
// ford-c01). No PDF (story tables have no pdf column, by design).
export const Route = createFileRoute('/_app/story/$id')({
  component: StoryView,
  loader: async ({ params }) => ({
    id: params.id,
    view: await getChapterView({ data: params.id }),
  }),
})

function StoryView() {
  const { id, view } = Route.useLoaderData()
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  const [quizOpen, setQuizOpen] = useState(false)
  const label = view ? `${view.storyTitle} · ${view.title}` : id

  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <button className="sr-navtoggle" aria-label="打开目录" type="button" onClick={() => setDrawer(true)}>
          <Menu size={18} />
        </button>
        <Link
          to="/"
          className="sr-btn ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
        >
          <ArrowLeft size={16} /> 返回
        </Link>
        <span className="sr-d-title">{label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sr-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
            onClick={() => setQuizOpen(true)}
          >
            <Layers size={16} /> 卡片答题
          </button>
        </div>
      </div>
      <div className="sr-d-scroll">
        {view?.html ? (
          // Trusted server-rendered Markdown (the saver rejects embedded HTML).
          <article className="sr-reading" dangerouslySetInnerHTML={{ __html: view.html }} />
        ) : (
          <p style={{ color: 'var(--sr-ink-dim)' }}>章节内容尚未生成。</p>
        )}
      </div>
      <QuizDrawer
        contentId={id}
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        fetchQuestions={getStoryQuestions}
        record={recordStoryAnswer}
      />
    </main>
  )
}
