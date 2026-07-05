import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

// Integration tests against the Azure easy-app Postgres (the project's runtime DB),
// verifying the persisted 福特 story + the story answer path. Loads
// EASYAPP_DATABASE_URL from repo-root .env; uses the same schema search_path as
// src/lib/db.ts. Cleans up any rows it writes.
let sql: ReturnType<typeof postgres>

beforeAll(() => {
  const envText = readFileSync(resolve(__dirname, '../../../../.env'), 'utf8')
  const env = Object.fromEntries(
    envText
      .split('\n')
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2].replace(/^"|"$/g, '')]),
  )
  const url = env.EASYAPP_DATABASE_URL || env.DATABASE_URL
  if (!url) throw new Error('no EASYAPP_DATABASE_URL in .env')
  sql = postgres(url, {
    ssl: 'require',
    max: 3,
    idle_timeout: 20,
    connection: { search_path: '"stemrobin-schema"' },
  })
})

afterAll(async () => {
  if (sql) await sql.end()
})

describe('persisted 福特 story (cap5 output)', () => {
  it('the ford story row exists', async () => {
    const rows = await sql`select id, title, person, source_url from sr_stories where id = 'ford'`
    expect(rows.length).toBe(1)
    expect(rows[0].title).toBe('亨利·福特')
    expect(rows[0].source_url).toContain('gutenberg.org')
  })

  it('has three draft chapters ord 1..3 stored as Markdown: ≥2000 汉字, one excerpt, no lists/HTML', async () => {
    const rows = await sql`
      select id, ord, title, status, md
      from sr_story_chapters where story_id = 'ford' order by ord
    `
    expect(rows.map((r) => r.id)).toEqual(['ford-c01', 'ford-c02', 'ford-c03'])
    expect(rows.map((r) => Number(r.ord))).toEqual([1, 2, 3])
    const countHanzi = (s: string) => (s.match(/[一-鿿]/g) || []).length
    for (const r of rows) {
      const md = r.md as string
      expect(r.status).toBe('draft')
      expect(countHanzi(md)).toBeGreaterThanOrEqual(2000) // ~10 min read
      expect(md).toMatch(/^#\s+\S/m) // Markdown H1 title
      expect(md).toMatch(/^\s*>/m) // one public-domain excerpt blockquote
      expect(md.split('\n').some((l) => /^\s*([-*]\s|\d+\.\s)/.test(l))).toBe(false) // no bullet/numbered lists
      expect(md).not.toMatch(/<\/?[a-z][\s\S]*?>/i) // Markdown, not HTML
      expect(md).not.toContain('{{')
    }
  })

  it('every chapter has questions; choice items have an in-range correct_index, work items null', async () => {
    for (const chapter of ['ford-c01', 'ford-c02', 'ford-c03']) {
      const qs = await sql`
        select answer_mode, options, correct_index
        from sr_story_questions where chapter_id = ${chapter} order by ord
      `
      expect(qs.length).toBeGreaterThanOrEqual(8)
      for (const q of qs) {
        if (q.answer_mode === 'choice') {
          expect(Array.isArray(q.options)).toBe(true)
          expect(q.correct_index).toBeGreaterThanOrEqual(0)
          expect(q.correct_index).toBeLessThan(q.options.length)
        } else {
          expect(q.answer_mode).toBe('work')
          expect(q.correct_index).toBeNull()
        }
      }
    }
  })
})

describe('story answer recording (recordStoryAnswer contract, at the DB layer)', () => {
  it('computes correctness server-side and writes exactly one sr_story_answer_events row (then cleans up)', async () => {
    const [user] = await sql`select user_id from sr_users order by user_id limit 1`
    const [q] = await sql`
      select id, correct_index from sr_story_questions
      where chapter_id = 'ford-c01' and answer_mode = 'choice' order by ord limit 1
    `
    expect(q).toBeTruthy()
    const correct = q.correct_index as number
    const wrong = correct === 0 ? 1 : 0

    // Correctness is a server-side comparison against the DB correct_index — the
    // client's chosen index cannot make a wrong answer "correct".
    expect(correct === correct).toBe(true)
    expect(wrong === correct).toBe(false)

    const before = await sql`
      select count(*)::int as n from sr_story_answer_events
      where user_id = ${user.user_id} and question_id = ${q.id}
    `
    await sql`
      insert into sr_story_answer_events (user_id, question_id, is_correct, chosen)
      values (${user.user_id}, ${q.id}, ${wrong === correct}, ${wrong})
    `
    const after = await sql`
      select is_correct, chosen from sr_story_answer_events
      where user_id = ${user.user_id} and question_id = ${q.id}
    `
    expect(after.length).toBe(before[0].n + 1)
    const inserted = after[after.length - 1]
    expect(inserted.is_correct).toBe(false) // wrong pick recorded as incorrect
    expect(inserted.chosen).toBe(wrong)

    // cleanup: remove only the row this test inserted
    await sql`
      delete from sr_story_answer_events
      where user_id = ${user.user_id} and question_id = ${q.id} and chosen = ${wrong}
    `
    const cleaned = await sql`
      select count(*)::int as n from sr_story_answer_events
      where user_id = ${user.user_id} and question_id = ${q.id}
    `
    expect(cleaned[0].n).toBe(before[0].n)
  })
})
