#!/usr/bin/env node
/**
 * cap3 的发布腿：把一课的交互规格并进 sr_lessons.exercises 的每道题对象，
 * 与 answerKey 同级。**不改表结构** —— exercises 本来就是 jsonb，answerKey 已经
 * 是同样的并入方式，沿用它就是「一个操作一条规范路径」。
 *
 * 规格只带作答形态与参数（标签、单位、坐标系、具名点），不带 expected，也不带
 * displayAnswer —— 判分仍然只在服务端做。
 *
 * 写库时逐题保留已有的 answerKey：这条与 ld-s10y-lesson 的发布器同一条规矩。
 *
 * 用法: publish-interactions.mjs <bookDir> --edition <name> --lesson <lessonId>... [--dry] [--env <path>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.resolve('app/package.json'))
const postgres = require('postgres')

const SCHEMA = 'ld-s10y-answer/lesson-interactions@1'

const args = process.argv.slice(2)
const bookDirArg = args.find((arg) => !arg.startsWith('--'))
const editionName = args.includes('--edition') ? args[args.indexOf('--edition') + 1] : null
const dry = args.includes('--dry')
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env'
const lessons = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--lesson' && args[index + 1]) lessons.push(args[index + 1])
}
if (!bookDirArg || !editionName || !lessons.length) {
  console.error(
    '用法: publish-interactions.mjs <bookDir> --edition <name> --lesson <lessonId>... [--dry] [--env <path>]',
  )
  process.exit(2)
}

function dbUrl() {
  const env = fs.readFileSync(envPath, 'utf8')
  for (const key of ['LEMMADECK_DATABASE_URL', 'EASYAPP_DATABASE_URL', 'DATABASE_URL']) {
    const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (match?.[1]?.trim()) return { key, url: match[1].trim() }
  }
  throw new Error(`${envPath} 里没有数据库连接串`)
}

const bookDir = path.resolve(bookDirArg)
const payloads = lessons.map((lesson) => {
  const file = path.join(
    bookDir, 'editions', editionName, 'lessons', lesson, 'interactions.json',
  )
  const document = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (document.schema !== SCHEMA) throw new Error(`${file} schema 不是 ${SCHEMA}`)
  if (document.status !== 'ready') throw new Error(`${file} 尚未 finalize`)
  if (document.edition !== editionName) throw new Error(`${file} edition 不匹配`)
  return { lesson, document }
})

for (const { lesson, document } of payloads) {
  const counts = {}
  for (const item of document.interactions) counts[item.widget] = (counts[item.widget] ?? 0) + 1
  const pending = document.interactions.filter((item) => item.needsAuthoring).length
  console.log(
    `[interactions] ${lesson}: ${document.count} 条 ${JSON.stringify(counts)}，待补 ${pending} 条`,
  )
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
  const stored = new Map()
  for (const { lesson } of payloads) {
    const rows = await sql`select exercises from sr_lessons where id = ${lesson}`
    if (!rows.length) throw new Error(`数据库中没有 lesson: ${lesson}`)
    const deck = rows[0].exercises
    if (!deck || !Array.isArray(deck.exercises)) {
      throw new Error(`${lesson} 的 exercises JSONB 不存在或结构错误`)
    }
    if (deck.edition !== editionName) {
      throw new Error(
        `${lesson} 数据库 edition=${deck.edition ?? '<missing>'}，拒绝写入 ${editionName} 规格`,
      )
    }
    stored.set(lesson, deck)
  }

  await sql.begin(async (tx) => {
    for (const { lesson, document } of payloads) {
      const deck = stored.get(lesson)
      const byExercise = new Map(
        document.interactions.map((item) => [String(item.exercise), item]),
      )
      if (byExercise.size !== deck.exercises.length) {
        throw new Error(
          `${lesson} 规格数量 ${byExercise.size} 与题目数量 ${deck.exercises.length} 不一致`,
        )
      }
      const exercises = deck.exercises.map((exercise) => {
        const item = byExercise.get(String(exercise.number))
        if (!item) throw new Error(`${lesson} exercise ${exercise.number} 没有交互规格`)
        // exercise 原样展开在前 —— answerKey 与题面、图都原封不动带过去。
        const { exercise: _number, ...interaction } = item
        return { ...exercise, interaction }
      })
      await tx`
        update sr_lessons
        set exercises = ${tx.json({ ...deck, exercises })}, updated_at = now()
        where id = ${lesson}
      `
    }
  })
  for (const { lesson } of payloads) console.log(`    ✓ ${lesson}`)
} finally {
  await sql.end()
}
