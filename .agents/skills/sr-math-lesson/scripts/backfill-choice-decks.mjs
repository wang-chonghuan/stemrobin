#!/usr/bin/env node
// Converts all persisted math decks to choice-only decks. It is deliberately
// separate from normal generation: it preserves every immutable question field
// and clears only the history the user explicitly approved for removal.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'

import { buildChoiceDeck, immutableSnapshot } from './choice-deck.mjs'

const apply = process.argv.includes('--apply')
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) throw new Error('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (match) env[match[1]] = match[2]
}
if (!env.EASYAPP_DATABASE_URL) throw new Error('no EASYAPP_DATABASE_URL in .env')

const sql = postgres(env.EASYAPP_DATABASE_URL, {
  ssl: 'require',
  max: 3,
  connection: { search_path: '"stemrobin-schema"' },
})

function validateDeck(deck, lessonId) {
  const ords = new Set()
  for (const question of deck) {
    if (question.answer_mode !== 'choice') throw new Error(`${lessonId} has a non-choice item`)
    if (!Array.isArray(question.options) || question.options.length < 3) throw new Error(`${lessonId} question ${question.ord} has too few options`)
    const options = question.options.map((option) => String(option).trim())
    if (options.some((option) => !option) || new Set(options).size !== options.length) {
      throw new Error(`${lessonId} question ${question.ord} has invalid options`)
    }
    if (!Number.isInteger(question.correct_index) || question.correct_index < 0 || question.correct_index >= options.length) {
      throw new Error(`${lessonId} question ${question.ord} has an invalid correct index`)
    }
    if (ords.has(question.ord)) throw new Error(`${lessonId} has duplicate ord ${question.ord}`)
    ords.add(question.ord)
  }
  if (![...ords].every((ord, index) => ord === index + 1)) throw new Error(`${lessonId} ords are not contiguous`)
}

async function main() {
  const lessons = await sql`
    select id, stage from sr_lessons where subject = 'math'
    order by stage, lesson_order
  `
  const converted = []
  for (const lesson of lessons) {
    const deck = await sql`
      select ord, layer, review_of, type, prompt, answer_mode, options,
             correct_index, accept, answer
      from sr_questions where lesson_id = ${lesson.id} order by ord
    `
    const next = buildChoiceDeck(deck)
    validateDeck(next, lesson.id)
    const before = immutableSnapshot(deck)
    const after = immutableSnapshot(next)
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`${lesson.id} changed immutable question data`)
    converted.push({ id: lesson.id, stage: lesson.stage, deck: next })
  }

  const total = converted.reduce((sum, lesson) => sum + lesson.deck.length, 0)
  const convertedCount = converted.reduce(
    (sum, lesson) => sum + lesson.deck.filter((question) => question.answer_mode === 'choice').length,
    0,
  )
  if (!apply) {
    console.log(`✓ dry run: ${converted.length} math lessons · ${total} choice questions`)
    await sql.end()
    return
  }

  const dir = mkdtempSync(join(tmpdir(), 'stemrobin-choice-decks-'))
  try {
    for (const lesson of converted) {
      writeFileSync(join(dir, `${lesson.id}.json`), `${JSON.stringify(lesson.deck, null, 2)}\n`)
    }

    // The user approved deleting all existing math history, including events
    // without an attempt id and empty/ended attempt rows.
    await sql`delete from sr_quiz_attempts`
    await sql`delete from sr_answer_events`
    await sql.end()

    for (const lesson of converted) {
      const ledger = `resources/content/math-ledger/stage-${lesson.stage}.json`
      execFileSync(process.execPath, [
        join(repoRoot, '.agents/skills/sr-math-lesson/scripts/save-lesson.mjs'),
        '--id', lesson.id,
        '--questions', join(dir, `${lesson.id}.json`),
        '--ledger', ledger,
        '--existing-deck', 'true',
      ], { cwd: repoRoot, stdio: 'inherit' })
    }
    console.log(`✓ backfilled ${converted.length} math lessons · ${convertedCount} choice questions`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main().catch(async (error) => {
  console.error(`✗ ${error.message}`)
  await sql.end()
  process.exit(1)
})
