import { createFileRoute, Link } from '@tanstack/react-router'
import { Atom, BookOpen, FileText, Menu, Rocket } from 'lucide-react'

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
        <span className="sr-d-title">总览</span>
      </div>

      <div className="sr-d-scroll">
        {/* Progress (mockup — wire to sr_answer_events / sr_progress later) */}
        <section className="sr-progress">
          <div className="sr-progress-top">
            <span className="sr-progress-title">学习进度</span>
            <span className="sr-progress-pct">
              8<span> / 96 课</span>
            </span>
          </div>
          <div className="sr-progress-bar">
            <span style={{ width: '8.3%' }} />
          </div>
          <div className="sr-progress-stats">
            <div className="sr-progress-stat">
              <b>8</b>
              <span>已学课程</span>
            </div>
            <div className="sr-progress-stat">
              <b>104</b>
              <span>已练题目</span>
            </div>
            <div className="sr-progress-stat">
              <b>5</b>
              <span>连续天数</span>
            </div>
          </div>
        </section>

        {/* Two pillars */}
        <section className="sr-section-gap">
          <div className="sr-pillars">
            <div className="sr-pillar">
              <span className="sr-pillar-ico blue"><Atom size={20} /></span>
              <div>
                <div className="sr-pillar-title">科学与工程</div>
                <p className="sr-pillar-desc">
                  只要你愿意学，AI 会帮你拆解路径、准备材料，陪你一步步掌握任何科学与工程知识。
                </p>
              </div>
            </div>
            <div className="sr-pillar">
              <span className="sr-pillar-ico green"><Rocket size={20} /></span>
              <div>
                <div className="sr-pillar-title">
                  创造者档案 <span className="sr-tag">即将上线</span>
                </div>
                <p className="sr-pillar-desc">
                  富兰克林、爱迪生、卡内基、福特……读发明家如何把创造变成事业，配理解与创业推理问答。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Live lessons */}
        <section className="sr-section-gap">
          <div className="sr-eyebrow">新上线课程（{AVAILABLE_LESSONS.length}）</div>
          <div className="sr-grid">
            {AVAILABLE_LESSONS.map((l) => (
              <Link
                key={l.id}
                to="/lesson/$id"
                params={{ id: l.id }}
                className="sr-card sr-lesson-card"
              >
                <span className="sr-lesson-card-ico">
                  <FileText size={17} />
                </span>
                <span className="sr-lesson-card-body">
                  <span className="sr-card-title">{l.title}</span>
                  <span className="sr-note">{l.subject}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
