#!/usr/bin/env node
/**
 * Merge selected lesson answer keys into sr_lessons.exercises.
 * The app projects only public answer-shape metadata; expected values and
 * displayAnswer stay server-side until the learner submits.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.resolve('app/package.json'))
const postgres = require('postgres')

const args = process.argv.slice(2)
const bookDirArg = args.find((arg) => !arg.startsWith('--'))
const dry = args.includes('--dry')
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env'
const lessons = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--lesson' && args[index + 1]) lessons.push(args[index + 1])
}
if (!bookDirArg || !lessons.length) {
  console.error('用法: publish.mjs <bookDir> --lesson <lessonId>... [--dry] [--env <path>]')
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
  const keyPath = path.join(bookDir, 'lessons', lesson, 'answer-keys.json')
  const document = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
  if (document.status !== 'ready') throw new Error(`${keyPath} 尚未 finalize`)
  return { lesson, document }
})

for (const { lesson, document } of payloads) {
  const auto = document.answers.filter((answer) => answer.grading === 'auto').length
  console.log(`[answers] ${lesson}: ${document.answers.length} answers, auto=${auto}, ungraded=${document.answers.length - auto}`)
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
  for (const { lesson, document } of payloads) {
    const rows = await sql`select exercises from sr_lessons where id = ${lesson}`
    if (!rows.length) throw new Error(`数据库中没有 lesson: ${lesson}`)
    const deck = rows[0].exercises
    if (!deck || !Array.isArray(deck.exercises)) {
      throw new Error(`${lesson} 的 exercises JSONB 不存在或结构错误`)
    }
    stored.set(lesson, deck)
  }

  await sql.begin(async (tx) => {
    for (const { lesson, document } of payloads) {
      const deck = stored.get(lesson)
      const byExercise = new Map(
        document.answers.map((answer) => [String(answer.exercise), answer]),
      )
      const exercises = deck.exercises.map((exercise) => {
        const answer = byExercise.get(String(exercise.number))
        if (!answer) throw new Error(`${lesson} exercise ${exercise.number} 没有 answer key`)
        return { ...exercise, answerKey: answer }
      })
      if (byExercise.size !== exercises.length) {
        throw new Error(`${lesson} answer key 数量与 exercise 数量不一致`)
      }
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
