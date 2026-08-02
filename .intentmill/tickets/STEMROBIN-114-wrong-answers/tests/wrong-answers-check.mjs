import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import fs, { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const require = createRequire(path.join(repoRoot, 'app/package.json'))
const { chromium } = require('playwright')
const postgres = require('postgres')

const BASE = process.argv[2] || 'http://127.0.0.1:3200'
const USER_ID = 2
const LESSON_ID = 'math5-c1-s1-n1'
const EXERCISE = '9'
const WRONG_ANSWER = `999999999${Date.now()}`
const SESSION_SECRET = process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'
const shots = path.join(here, 'screenshots')
mkdirSync(shots, { recursive: true })

function envValue(name) {
  const direct = process.env[name]
  if (direct) return direct
  const env = fs.readFileSync(path.join(repoRoot, '.env'), 'utf8')
  return env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
}

function signSession(userId) {
  const mac = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(String(userId))
    .digest('hex')
  return `${userId}.${mac}`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function setMathValue(target, value) {
  const field = target.locator('math-field').first()
  await field.waitFor({ state: 'visible' })
  await field.evaluate((element, next) => {
    element.value = next
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

const dbUrl = envValue('LEMMADECK_DATABASE_URL')
if (!dbUrl) throw new Error('LEMMADECK_DATABASE_URL is required')
const db = postgres(dbUrl, {
  ssl: 'require',
  max: 1,
  connect_timeout: 15,
  connection: { search_path: '"lemmadeck-schema"' },
})

let baselineEventId = 0
let baselineMistakeId = 0
let createdMistakeId = null
const createdEventIds = []
let correctAnswer = null
const browser = await chromium.launch({ headless: false })

try {
  const eventBaseline = await db`
    select coalesce(max(id), 0)::bigint as id
    from sr_content_answer_events
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and kind = 'exercise'
      and node_id = ${EXERCISE}
  `
  const mistakeBaseline = await db`
    select coalesce(max(id), 0)::bigint as id
    from sr_textbook_mistakes
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and exercise_number = ${EXERCISE}
  `
  baselineEventId = Number(eventBaseline[0].id)
  baselineMistakeId = Number(mistakeBaseline[0].id)
  const lessonRows = await db`
    select exercises
    from sr_lessons
    where id = ${LESSON_ID}
  `
  const fixtureExercise = lessonRows[0]?.exercises?.exercises?.find(
    (item) => String(item.number) === EXERCISE,
  )
  correctAnswer = fixtureExercise?.answerKey?.parts?.[0]?.expected?.[0] ?? null
  assert(typeof correctAnswer === 'string' && correctAnswer, 'test fixture has no answer key')

  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  const base = new URL(BASE)
  await context.addCookies([
    {
      name: 'sr_session',
      value: signSession(USER_ID),
      domain: base.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'sr_locale', value: 'en', domain: base.hostname, path: '/' },
  ])
  const page = await context.newPage()

  // AC1: submit a real wrong answer and prove a new durable row, not a
  // pre-existing matching row, is what the notebook displays.
  await page.goto(`${BASE}/card/${LESSON_ID}?tab=ex&exercise=${EXERCISE}`, {
    waitUntil: 'networkidle',
  })
  const target = page.locator(`#ex-${EXERCISE}`)
  await target.waitFor({ state: 'visible' })
  await setMathValue(target, WRONG_ANSWER)
  await target.locator('.sr-math-submit').click()
  await target.locator('.sr-math-result.incorrect').waitFor({ state: 'visible' })

  const newMistakes = await db`
    select id::text, book_id, lesson_id, exercise_number, occurred_at
    from sr_textbook_mistakes
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and exercise_number = ${EXERCISE}
      and id > ${baselineMistakeId}
    order by id
  `
  assert(newMistakes.length === 1, `expected one new mistake row, got ${newMistakes.length}`)
  const mistake = newMistakes[0]
  createdMistakeId = Number(mistake.id)
  const occurredAt = new Date(mistake.occurred_at).toISOString()
  assert(mistake.book_id === '5m', `expected book 5m, got ${mistake.book_id}`)

  const newWrongEvents = await db`
    select id::text, is_correct
    from sr_content_answer_events
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and kind = 'exercise'
      and node_id = ${EXERCISE}
      and id > ${baselineEventId}
      and answer_text = ${WRONG_ANSWER}
    order by id
  `
  assert(
    newWrongEvents.length === 1 && newWrongEvents[0].is_correct === false,
    'wrong submission did not create exactly one incorrect answer event',
  )
  createdEventIds.push(Number(newWrongEvents[0].id))

  await page.locator('.sr-usermenu-trigger').click()
  await page.locator('.sr-usermenu-item[href="/mistakes"]').click()
  await page.waitForURL(`${BASE}/mistakes`)

  const row = page.locator(`[data-mistake-id="${mistake.id}"]`)
  await row.waitFor({ state: 'visible' })
  const group = row.locator('xpath=ancestor::*[@data-mistake-date][1]')
  const iso = await row.locator('time').getAttribute('datetime')
  const visibleTime = (await row.locator('time').innerText()).trim()
  const date = await group.getAttribute('data-mistake-date')
  assert(iso === occurredAt, `displayed timestamp ${iso} does not match new row ${occurredAt}`)
  assert(visibleTime.endsWith(' UTC'), `wrong-answer time is not labelled UTC: ${visibleTime}`)
  assert(date === occurredAt.slice(0, 10), `UTC date group ${date} is incorrect`)
  assert(
    (await page.getByRole('tab', { name: /By date/ }).getAttribute('aria-selected')) ===
      'true',
    'date view tab is not selected',
  )
  await page.screenshot({ path: path.join(shots, 'mistakes-desktop.png'), fullPage: false })
  console.log('PASS AC1: the actual wrong submission created and displayed one durable UTC row')

  // AC2: redo the exact exercise, submit a correct answer, then prove the
  // historical mistake remains and no second mistake was created.
  await row.getByRole('link').click()
  await page.waitForURL((url) =>
    url.pathname === `/card/${LESSON_ID}` &&
    url.searchParams.get('tab') === 'ex' &&
    url.searchParams.get('exercise') === EXERCISE,
  )
  const redoTarget = page.locator(`#ex-${EXERCISE}.sr-ex-target`)
  await redoTarget.waitFor({ state: 'visible' })
  await page.waitForFunction((exercise) => {
    const current = document.getElementById(`ex-${exercise}`)
    if (!current) return false
    const rect = current.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= window.innerHeight
  }, EXERCISE)
  assert(
    (await page.getByRole('tab', { name: /Exercises/ }).getAttribute('aria-selected')) ===
      'true',
    'redo did not open the exercises tab',
  )
  await setMathValue(redoTarget, correctAnswer)
  await redoTarget.locator('.sr-math-submit').click()
  await redoTarget.locator('.sr-math-result.correct').waitFor({ state: 'visible' })

  const newCorrectEvents = await db`
    select id::text, is_correct
    from sr_content_answer_events
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and kind = 'exercise'
      and node_id = ${EXERCISE}
      and id > ${createdEventIds[0]}
      and answer_text = ${correctAnswer}
    order by id
  `
  assert(
    newCorrectEvents.length === 1 && newCorrectEvents[0].is_correct === true,
    'correct redo did not create exactly one correct answer event',
  )
  createdEventIds.push(Number(newCorrectEvents[0].id))

  const persisted = await db`
    select count(*)::int as count
    from sr_textbook_mistakes
    where id = ${createdMistakeId}
  `
  const mistakeCount = await db`
    select count(*)::int as count
    from sr_textbook_mistakes
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and exercise_number = ${EXERCISE}
      and id > ${baselineMistakeId}
  `
  assert(persisted[0].count === 1, 'correct redo removed the original mistake row')
  assert(mistakeCount[0].count === 1, 'correct redo created an extra mistake row')
  await page.screenshot({ path: path.join(shots, 'redo-target-desktop.png'), fullPage: false })
  console.log('PASS AC2: redo submitted correctly and preserved the original mistake history')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/mistakes`, { waitUntil: 'networkidle' })
  await page.locator(`[data-mistake-id="${mistake.id}"]`).waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(shots, 'mistakes-mobile.png'), fullPage: false })
  console.log('PASS responsive check: mistakes view renders on mobile')
} finally {
  await browser.close()
  if (createdMistakeId != null) {
    await db`delete from sr_textbook_mistakes where id = ${createdMistakeId}`
  }
  for (const eventId of createdEventIds) {
    await db`delete from sr_content_answer_events where id = ${eventId}`
  }
  await db.end()
}
