#!/usr/bin/env node
// One-off THROWAWAY migration (D6): parse each existing static lesson
// public/lessons/<id>.html into the Azure easy-app Postgres model —
// sr_lessons (課文 HTML + PDF bytes) + sr_questions (from the practice section).
// Existing hand-authored items have no options, so they are imported faithfully as
// answer_mode='work' (no invented options). Generating choice options for old
// lessons is a documented follow-up. Not a kept capability.
import postgres from 'postgres'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
)
const sql = postgres(env.EASYAPP_DATABASE_URL, {
  ssl: 'require',
  max: 3,
  connection: { search_path: '"stemrobin-schema"' },
})

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

function parseLesson(html, id) {
  const m = id.match(/^(math|physics)-s(\d+)-(\d+)$/)
  const [, subject, stage, order] = m
  const title = (html.match(/<h1 class="sr-l-title">([\s\S]*?)<\/h1>/) || [])[1]
  const concept = (html.match(/<div class="sr-l-concept">([\s\S]*?)<\/div>/) || [])[1]
  // practice section
  const pStart = html.indexOf('<section data-sr-section="practice"')
  const questions = []
  if (pStart !== -1) {
    const pEnd = html.indexOf('</section>', pStart)
    const block = html.slice(pStart, pEnd)
    const lis = block.match(/<li\b[\s\S]*?<\/li>/g) || []
    lis.forEach((li, i) => {
      const type = ((li.match(/<span class="sr-ptype">([\s\S]*?)<\/span>/) || [])[1] || '操作').trim()
      const answer = stripTags((li.match(/<div class="sr-answer">([\s\S]*?)<\/div>/) || [])[1] || '')
      const prompt = stripTags(
        li
          .replace(/<span class="sr-ptype">[\s\S]*?<\/span>/, '')
          .replace(/<div class="sr-answer">[\s\S]*?<\/div>/, ''),
      )
      if (prompt) questions.push({ ord: i + 1, type, prompt, answer })
    })
  }
  return {
    id,
    subject,
    stage: +stage,
    order: +order,
    title: stripTags(title || id),
    concept: stripTags(concept || ''),
    questions,
  }
}

const dir = join(ROOT, 'public', 'lessons')
const files = readdirSync(dir).filter((f) => /^(math|physics)-s\d+-\d+\.html$/.test(f))
let lessonN = 0
let qN = 0
for (const f of files) {
  const id = f.replace('.html', '')
  const html = readFileSync(join(dir, f), 'utf8')
  const L = parseLesson(html, id)
  const pdfPath = join(dir, `${id}.pdf`)
  const pdf = existsSync(pdfPath) ? readFileSync(pdfPath) : null

  await sql`
    insert into sr_lessons (id, subject, stage, lesson_order, title, concept, html, pdf, status, updated_at)
    values (${L.id}, ${L.subject}, ${L.stage}, ${L.order}, ${L.title}, ${L.concept},
            ${html}, ${pdf}, 'published', now())
    on conflict (id) do update set
      subject=excluded.subject, stage=excluded.stage, lesson_order=excluded.lesson_order,
      title=excluded.title, concept=excluded.concept, html=excluded.html, pdf=excluded.pdf,
      status='published', updated_at=now()
  `
  await sql`delete from sr_questions where lesson_id = ${L.id}`
  for (const q of L.questions) {
    await sql`
      insert into sr_questions (lesson_id, ord, type, prompt, answer_mode, options, correct_index, answer)
      values (${L.id}, ${q.ord}, ${q.type}, ${q.prompt}, 'work', null, null, ${q.answer})
    `
    qN++
  }
  lessonN++
  console.log(`  ${id}: lesson + ${L.questions.length} questions (pdf: ${pdf ? Math.round(pdf.length / 1024) + 'KB' : 'none'})`)
}
console.log(`migrated ${lessonN} lessons, ${qN} questions`)
await sql.end()
