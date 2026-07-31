#!/usr/bin/env node
/**
 * cap5：把装订好的小节写进内容库，让它在产品里变成可点的一课。
 *
 * app 的设计已经替我们决定了落点（见 app/src/lib/deck-stats.ts）：
 * **一张卡片的内容写入时，它在 sr_lessons 的行就用卡片自己的 id**，所以这里不建新表，
 * 一个小节 = 一行，id 就是 cap2 从 TOC 认领来的卡片 id（math5-c1-s1-n1）。
 *
 *   html      ← text.html      自包含课文（KaTeX 已渲染、字体与 SVG 已内联）
 *   content   ← lesson.json    结构化课文块 + 元数据
 *   exercises ← exercises.json 每题独立编号、带自己的图
 *
 * 连接串取自仓库根的 .env，`LEMMADECK_DATABASE_URL` 优先——内容库已从 Azure 迁到
 * Supabase，schema 是 lemmadeck-schema。**不要用 psql**：这个串的密码里带 `@`，
 * psql 会把它当主机名分隔符，解析失败；node 的 postgres 客户端能正确处理。
 *
 * 用法: publish.mjs <bookDir> [--dry] [--env <path>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const postgres = require('postgres')

const args = process.argv.slice(2)
const bookDir = args.find((a) => !a.startsWith('--'))
const dry = args.includes('--dry')
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env'
if (!bookDir) {
  console.error('用法: publish.mjs <bookDir> [--dry] [--env <path>]')
  process.exit(2)
}

function dbUrl() {
  const env = fs.readFileSync(envPath, 'utf8')
  for (const key of ['LEMMADECK_DATABASE_URL', 'EASYAPP_DATABASE_URL', 'DATABASE_URL']) {
    const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (m?.[1]?.trim()) return { key, url: m[1].trim() }
  }
  throw new Error(`${envPath} 里没有任何数据库连接串`)
}

const book = path.resolve(bookDir)
const lessonsDir = path.join(book, 'lessons')
const rows = []
for (const lid of fs.readdirSync(lessonsDir).sort()) {
  const dir = path.join(lessonsDir, lid)
  const L = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.json'), 'utf8'))
  const X = JSON.parse(fs.readFileSync(path.join(dir, 'exercises.json'), 'utf8'))
  const htmlPath = path.join(dir, 'text.html')
  if (!L.card_id) {
    console.error(`  ✗ ${lid}: 没有卡片 id（assemble 时没给 --toc，或 TOC 里对不上），跳过`)
    continue
  }
  if (!fs.existsSync(htmlPath)) {
    console.error(`  ✗ ${lid}: 缺 text.html，先跑 p2c.py render`)
    continue
  }
  // stage/lesson_order 是 (subject, stage, lesson_order) 唯一约束的一半：年级 +
  // 本册内连续的印刷小节号。同年级同学科的两册（代数六年级 / 几何六-八年级）会撞，
  // 撞到时这里会报出来，不静默覆盖。
  const grade = Number(/^[a-z]*(\d+)/.exec(L.card_id.replace(/^math|^physics/, ''))?.[1] ?? 0)
  rows.push({
    id: L.card_id,
    subject: 'math',
    stage: grade || 0,
    lesson_order: Number(L.number),
    title: L.printed_title || L.title,
    concept: [L.chapter, L.section].filter(Boolean).join(' · '),
    html: fs.readFileSync(htmlPath, 'utf8'),
    content: L,
    exercises: X,
  })
}

console.log(`[publish] ${book} → ${rows.length} 行`)
for (const r of rows) {
  console.log(`    ${r.id}  ${r.title}  html ${(r.html.length / 1024) | 0}KB  `
    + `题 ${r.exercises.count} 道  stage=${r.stage} order=${r.lesson_order}`)
}
if (dry) {
  console.log('  (--dry：没有写库)')
  process.exit(0)
}

const { key, url } = dbUrl()
console.log(`  连接 ${key}`)
const sql = postgres(url, {
  ssl: 'require',
  connection: { search_path: '"lemmadeck-schema"' },
  connect_timeout: 15,
})
try {
  for (const r of rows) {
    await sql`
      insert into sr_lessons
        (id, subject, stage, lesson_order, title, concept, html, content, exercises, status)
      values (${r.id}, ${r.subject}, ${r.stage}, ${r.lesson_order}, ${r.title},
              ${r.concept}, ${r.html}, ${sql.json(r.content)}, ${sql.json(r.exercises)}, 'draft')
      on conflict (id) do update set
        subject = excluded.subject, stage = excluded.stage,
        lesson_order = excluded.lesson_order, title = excluded.title,
        concept = excluded.concept, html = excluded.html,
        content = excluded.content, exercises = excluded.exercises,
        updated_at = now()
    `
    console.log(`    ✓ ${r.id}`)
  }
  const all = await sql`select id, subject, length(html) as html from sr_lessons order by id`
  console.log('  库中现有:', all.map((x) => `${x.id}(${x.html ?? 0})`).join(', '))
} finally {
  await sql.end()
}
