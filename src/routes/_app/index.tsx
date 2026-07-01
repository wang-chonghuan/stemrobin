import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, FileText, Menu } from 'lucide-react'

import { AVAILABLE_LESSONS } from '~/lib/curriculum'
import { useLayoutStore } from '~/lib/layout-store'

export const Route = createFileRoute('/_app/')({
  component: Overview,
})

function Overview() {
  const setDrawer = useLayoutStore((s) => s.setDrawer)
  return (
    <main className="sr-detail">
      <div className="sr-d-top">
        <button
          className="sr-navtoggle"
          aria-label="打开目录"
          type="button"
          onClick={() => setDrawer(true)}
        >
          <Menu size={18} />
        </button>
        <BookOpen size={18} color="var(--sr-blue)" />
        <span className="sr-d-title">课程总览</span>
      </div>

      <div className="sr-d-scroll">
        <div className="sr-section-gap">
          <div className="sr-eyebrow accent">StemRobin</div>
          <h1 className="sr-title">初中数学 · 物理入口课程</h1>
          <p className="sr-sub">
            内容按初中标准，解释按儿童认知，训练按严肃教材。左侧是完整课程大纲，可展开每个阶段；已生成的课程可直接点击打开。
          </p>
        </div>

        <div className="sr-section-gap">
          <div className="sr-eyebrow">已上线课程（{AVAILABLE_LESSONS.length}）</div>
          <div className="sr-grid">
            {AVAILABLE_LESSONS.map((l) => (
              <Link
                key={l.id}
                to="/lesson/$id"
                params={{ id: l.id }}
                className="sr-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <span
                  style={{
                    width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: 8, background: 'var(--sr-blue-tint)', color: 'var(--sr-blue-deep)',
                  }}
                >
                  <FileText size={17} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span className="sr-card-title" style={{ margin: 0 }}>{l.title}</span>
                  <span className="sr-note">{l.subject}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
