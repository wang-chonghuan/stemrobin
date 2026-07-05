import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Static/source contract tests (no DB). They guard the invariants the spec calls
// "Critical Existing Contracts" — especially answer-key secrecy — and the
// rejected options that must stay absent, by asserting on the actual source.
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const stories = read('src/lib/stories.ts')
const quiz = read('src/lib/quiz.ts')
const drawer = read('src/components/quiz-drawer.tsx')
const lessonRoute = read('src/routes/_app/lesson.$id.tsx')
const storyRoute = read('src/routes/_app/story.$id.tsx')
const catalog = read('src/components/catalog.tsx')
const appShell = read('src/routes/_app.tsx')
const schema = read('ssot-schemas/db-schemas/stemrobin.sql')

// Slice a source string between a start marker and the next marker (exclusive),
// to scope assertions to one function.
function block(src: string, start: string, end: string): string {
  const i = src.indexOf(start)
  const j = end ? src.indexOf(end, i + start.length) : src.length
  expect(i, `marker not found: ${start}`).toBeGreaterThanOrEqual(0)
  return src.slice(i, j === -1 ? src.length : j)
}

describe('answer-key secrecy (story questions payload)', () => {
  const getQ = block(stories, 'export const getStoryQuestions', 'export const recordStoryAnswer')

  it('getStoryQuestions selects exactly the non-secret columns (no correct_index / answer)', () => {
    // The one DB read in getStoryQuestions must select only these columns — the
    // answer key (correct_index) and worked answer must never reach the client.
    const m = getQ.match(
      /select ([^\n]*)\n\s*from sr_story_questions where chapter_id/,
    )
    expect(m?.[1]).toBe('id, ord, type, prompt, answer_mode, options')
  })

  it('the QuizQuestion type carries no correct answer field', () => {
    const t = block(quiz, 'export type QuizQuestion', 'export const')
    expect(t).not.toContain('correct')
    expect(t).toContain('options')
  })
})

describe('recordStoryAnswer is auth-gated and server-authoritative', () => {
  const rec = block(stories, 'export const recordStoryAnswer', '')

  it('requires a logged-in learner', () => {
    expect(rec).toContain('currentUserId()')
    expect(rec).toContain("return { error: '请先登录' }")
  })

  it('rejects non-choice questions', () => {
    expect(rec).toContain("answer_mode !== 'choice'")
  })

  it('computes correctness server-side from the DB correct_index', () => {
    expect(rec).toContain('correct_index')
    expect(rec).toContain('data.chosen === correctIndex')
  })

  it('writes the event to sr_story_answer_events (not the lesson table)', () => {
    expect(rec).toContain('insert into sr_story_answer_events')
    expect(rec).not.toContain('sr_answer_events (user_id') // lesson table untouched here
  })
})

describe('lesson quiz path is not regressed by parametrization', () => {
  it('getLessonQuestions still hides correct_index', () => {
    const g = block(quiz, 'export const getLessonQuestions', 'export type AnswerResult')
    expect(g).toContain('select id, ord, type, prompt, answer_mode, options')
    expect(g).not.toContain('correct_index')
  })

  it('recordAnswer still writes to sr_answer_events', () => {
    const r = block(quiz, 'export const recordAnswer', '')
    expect(r).toContain('insert into sr_answer_events')
    expect(r).toContain('currentUserId()')
  })
})

describe('QuizDrawer is fully injected (single shared component)', () => {
  it('no longer imports lesson-specific server fns', () => {
    expect(drawer).not.toMatch(/import\s*\{[^}]*getLessonQuestions/)
    expect(drawer).not.toMatch(/import\s*\{[^}]*\brecordAnswer\b/)
  })

  it('uses the injected fetchQuestions + record props', () => {
    expect(drawer).toContain('fetchQuestions({ data: contentId })')
    expect(drawer).toContain('await record({')
  })

  it('lesson route injects the lesson source', () => {
    expect(lessonRoute).toContain('fetchQuestions={getLessonQuestions}')
    expect(lessonRoute).toContain('record={recordAnswer}')
  })

  it('story route injects the story source', () => {
    expect(storyRoute).toContain('fetchQuestions={getStoryQuestions}')
    expect(storyRoute).toContain('record={recordStoryAnswer}')
  })
})

describe('rejected options stay absent', () => {
  it('story chapter list is DB-driven, not hardcoded into curriculum.ts', () => {
    expect(appShell).toContain('getStoryCatalog')
    expect(catalog).toContain('StoryCatalogEntry')
    expect(stories).not.toMatch(/from '~\/lib\/curriculum'/) // no import of the static outline
  })

  it('story reading route has no PDF download (out of scope)', () => {
    expect(storyRoute).not.toContain('Pdf')
  })

  it('the lesson answer-events FK is unchanged and the story table targets its own id-space', () => {
    expect(schema).toMatch(/sr_answer_events[\s\S]*question_id\s+BIGINT NOT NULL REFERENCES sr_questions\(id\)/)
    expect(schema).toMatch(/sr_story_answer_events[\s\S]*question_id\s+BIGINT NOT NULL REFERENCES sr_story_questions\(id\)/)
  })
})
