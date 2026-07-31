#!/usr/bin/env node
/**
 * cap5：把装订好的小节写进内容库，让它在产品里变成可点的一课。
 *
 * app 的设计已经替我们决定了落点（见 app/src/lib/deck-stats.ts）：
 * **一张卡片的内容写入时，它在 sr_lessons 的行就用卡片自己的 id**，所以这里不建新表，
 * 一个小节 = 一行，id 就是 cap2 从 TOC 认领来的卡片 id（math5-c1-s1-n1）。
 *
 *   content   ← 课文块，每块一段**可直接嵌入的 HTML 片段**（KaTeX 已渲染，插图内联 SVG）
 *   exercises ← 每道题一条：题号、所属栏目、题干片段、自己的图
 *   html      ← 留空。整份自包含文档只适合单独打开；塞进产品会变成"文档中的文档"，
 *               字体版式与宿主两套，高度还得靠 JS 猜。产品侧用上面两列原生渲染。
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
const { inline, figureSvg } = require('./htmlfrag.js')

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
  if (!L.card_id) {
    console.error(`  ✗ ${lid}: 没有卡片 id（assemble 时没给 --toc，或 TOC 里对不上），跳过`)
    continue
  }
  const prose = L.prose.map((b) =>
    b.kind === 'fig'
      ? { kind: 'fig', id: b.id, label: b.label, svg: figureSvg(book, b.id) }
      : { kind: b.kind, html: inline(b.text) })
  const exercises = X.exercises.map((e) => ({
    number: e.number,
    group: e.group,
    html: inline(e.text),
    figures: (e.figures ?? []).map((f) => ({ id: f.id, label: f.label, svg: figureSvg(book, f.id) })),
  }))
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
    content: { ...L, prose },
    exercises: { count: exercises.length, exercises },
  })
}

console.log(`[publish] ${book} → ${rows.length} 行`)
for (const r of rows) {
  const kb = (JSON.stringify(r.content).length + JSON.stringify(r.exercises).length) / 1024
  console.log(`    ${r.id}  ${r.title}  正文 ${r.content.prose.length} 块  `
    + `题 ${r.exercises.count} 道  ${kb | 0}KB  stage=${r.stage} order=${r.lesson_order}`)
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
        (id, subject, stage, lesson_order, title, concept, content, exercises, status)
      values (${r.id}, ${r.subject}, ${r.stage}, ${r.lesson_order}, ${r.title},
              ${r.concept}, ${sql.json(r.content)}, ${sql.json(r.exercises)}, 'draft')
      on conflict (id) do update set
        subject = excluded.subject, stage = excluded.stage,
        lesson_order = excluded.lesson_order, title = excluded.title,
        concept = excluded.concept, html = null,
        content = excluded.content, exercises = excluded.exercises,
        updated_at = now()
    `
    console.log(`    ✓ ${r.id}`)
  }
  const all = await sql`
    select id, subject, jsonb_array_length(content->'prose') as prose,
           coalesce((exercises->>'count')::int, 0) as ex
    from sr_lessons order by id`
  for (const x of all) console.log(`    · ${x.id}  正文 ${x.prose ?? '-'} 块  题 ${x.ex} 道`)
} finally {
  await sql.end()
}
