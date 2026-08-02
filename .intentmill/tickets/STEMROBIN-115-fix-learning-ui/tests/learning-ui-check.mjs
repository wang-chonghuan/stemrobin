import crypto from 'node:crypto'
import fs, { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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

function auditGeneratedExercises() {
  const root = path.join(
    repoRoot,
    'resources/s10y-lessons/5m/editions/modern-us-neutral/lessons',
  )
  let lessonCount = 0
  let exerciseCount = 0
  let numberedCount = 0
  const problems = []
  for (const lessonId of fs.readdirSync(root).sort()) {
    const file = path.join(root, lessonId, 'exercises.json')
    if (!fs.existsSync(file)) continue
    lessonCount += 1
    const document = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const exercise of document.exercises ?? []) {
      exerciseCount += 1
      const text = String(exercise.text ?? '')
      const masked = text.replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, (math) =>
        ' '.repeat(math.length),
      )
      const markers = []
      for (const match of masked.matchAll(/(\d{1,2})[)）]/g)) {
        const before = masked.slice(Math.max(0, match.index - 3), match.index)
        const previous = masked[match.index - 1] ?? ''
        if (/[\w.]/u.test(previous) || /图\s*$/u.test(before)) continue
        markers.push({ number: Number(match[1]), index: match.index })
      }
      if (markers.length < 2) continue
      const numbers = markers.map((marker) => marker.number)
      const complete =
        new Set(numbers).size === numbers.length &&
        [...numbers].sort((a, b) => a - b).every((number, index) => number === index + 1)
      if (!complete) continue
      numberedCount += 1
      const ordered = numbers.every((number, index) => number === index + 1)
      const lineBroken = markers.every(
        (marker) => marker.index === 0 || text[marker.index - 1] === '\n',
      )
      if (!ordered || !lineBroken) {
        problems.push({
          lessonId,
          exercise: exercise.number,
          numbers,
          ordered,
          lineBroken,
        })
      }
    }
  }
  assert(problems.length === 0, `generated exercise audit failed: ${JSON.stringify(problems)}`)
  assert(lessonCount === 16, `expected 16 generated lessons, got ${lessonCount}`)
  assert(exerciseCount === 285, `expected 285 generated exercises, got ${exerciseCount}`)
  assert(numberedCount === 108, `expected 108 numbered exercises, got ${numberedCount}`)
  console.log('PASS AC1 content audit: 16 lessons, 285 exercises, 108 numbered, 0 problems')
}

async function setMathValue(target, value) {
  const field = target.locator('math-field').first()
  await field.waitFor({ state: 'visible' })
  await field.evaluate((element, next) => {
    element.value = next
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

async function assertMobileShell(page, finalLocator) {
  const top = page.locator('.sr-d-top')
  const scroll = page.locator('.sr-d-scroll')
  await top.waitFor({ state: 'visible' })
  await scroll.waitFor({ state: 'visible' })
  const initial = await page.evaluate(() => {
    const header = document.querySelector('.sr-d-top').getBoundingClientRect()
    const pane = document.querySelector('.sr-d-scroll').getBoundingClientRect()
    return { headerTop: header.top, headerBottom: header.bottom, paneTop: pane.top }
  })
  assert(Math.abs(initial.headerTop) <= 1, `topbar is not fixed at top: ${initial.headerTop}`)
  assert(
    initial.paneTop >= initial.headerBottom - 1,
    `topbar overlaps content: header=${initial.headerBottom}, pane=${initial.paneTop}`,
  )

  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(100)
  const final = await page.evaluate((selector) => {
    const header = document.querySelector('.sr-d-top').getBoundingClientRect()
    const pane = document.querySelector('.sr-d-scroll').getBoundingClientRect()
    const target = document.querySelector(selector).getBoundingClientRect()
    const scroll = document.querySelector('.sr-d-scroll')
    return {
      headerTop: header.top,
      targetBottom: target.bottom,
      paneBottom: pane.bottom,
      scrollTop: scroll.scrollTop,
      maxScroll: scroll.scrollHeight - scroll.clientHeight,
    }
  }, finalLocator)
  assert(Math.abs(final.headerTop) <= 1, `topbar moved after scroll: ${final.headerTop}`)
  assert(
    Math.abs(final.scrollTop - final.maxScroll) <= 2,
    `page bottom was not reachable: ${final.scrollTop}/${final.maxScroll}`,
  )
  assert(
    final.targetBottom <= final.paneBottom + 1,
    `final content is occluded: ${final.targetBottom}/${final.paneBottom}`,
  )
}

auditGeneratedExercises()

const dbUrl = envValue('LEMMADECK_DATABASE_URL')
if (!dbUrl) throw new Error('LEMMADECK_DATABASE_URL is required')
const db = postgres(dbUrl, {
  ssl: 'require',
  max: 1,
  connect_timeout: 15,
  connection: { search_path: '"lemmadeck-schema"' },
})

async function summary() {
  const [row] = await db`
    select
      count(*)::int as total,
      count(*) filter (
        where exists (
          select 1
          from sr_content_answer_events event
          where event.user_id = mistake.user_id
            and event.lesson_id = mistake.lesson_id
            and event.kind = 'exercise'
            and event.node_id = mistake.exercise_number
            and event.is_correct
            and event.created_at > mistake.occurred_at
        )
      )::int as corrected
    from sr_textbook_mistakes mistake
    where mistake.user_id = ${USER_ID}
  `
  return { corrected: Number(row.corrected), total: Number(row.total) }
}

const createdEventIds = []
let createdMistakeId = null
const browser = await chromium.launch({ headless: false })

try {
  const before = await summary()
  const [mistakeBaseline] = await db`
    select coalesce(max(id), 0)::bigint as id
    from sr_textbook_mistakes
    where user_id = ${USER_ID}
  `
  const [eventBaseline] = await db`
    select coalesce(max(id), 0)::bigint as id
    from sr_content_answer_events
    where user_id = ${USER_ID}
  `
  const [lesson] = await db`select exercises from sr_lessons where id = ${LESSON_ID}`
  const fixture = lesson.exercises.exercises.find(
    (item) => String(item.number) === EXERCISE,
  )
  const correctAnswer = fixture?.answerKey?.parts?.[0]?.expected?.[0]
  assert(typeof correctAnswer === 'string' && correctAnswer, 'fixture answer is missing')

  const base = new URL(BASE)
  const cookies = [
    {
      name: 'sr_session',
      value: signSession(USER_ID),
      domain: base.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'sr_locale', value: 'zh', domain: base.hostname, path: '/' },
  ]

  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  await desktopContext.addCookies(cookies)
  const desktopPage = await desktopContext.newPage()

  await desktopPage.goto(`${BASE}/card/${LESSON_ID}?tab=ex&exercise=1`, {
    waitUntil: 'networkidle',
  })
  const firstText = (
    await desktopPage.locator('#ex-1 .sr-ex-body > div').first().innerText()
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  assert(
    firstText.filter((line) => /^\d+[)）]/.test(line)).map((line) => line.match(/^\d+/)[0]).join(',') ===
      '1,2,3,4,5,6',
    `exercise 1 rendered out of order: ${firstText.join(' | ')}`,
  )

  await desktopPage.goto(`${BASE}/card/${LESSON_ID}?tab=ex&exercise=${EXERCISE}`, {
    waitUntil: 'networkidle',
  })
  const desktopTarget = desktopPage.locator(`#ex-${EXERCISE}`)
  await desktopTarget.waitFor({ state: 'visible' })
  const desktopMore = desktopTarget.getByRole('button', { name: '更多' })
  assert(
    (await desktopMore.getAttribute('aria-pressed')) === 'true',
    'More is not selected by default',
  )
  await desktopTarget.locator('math-field').first().focus()
  assert(
    (await desktopMore.getAttribute('aria-pressed')) === 'true',
    'More is not selected after first answer focus',
  )
  await desktopPage.screenshot({
    path: path.join(shots, 'exercise-desktop-more.png'),
  })
  await desktopContext.close()
  console.log('PASS AC1 browser: exercise 1 is ordered and the first answer focus uses More')

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addCookies(cookies)
  const page = await context.newPage()
  await page.goto(`${BASE}/card/${LESSON_ID}?tab=ex&exercise=${EXERCISE}`, {
    waitUntil: 'networkidle',
  })
  const target = page.locator(`#ex-${EXERCISE}`)
  await target.waitFor({ state: 'visible' })
  await setMathValue(target, WRONG_ANSWER)
  await target.locator('.sr-math-submit').click()
  await target.locator('.sr-math-result.incorrect').waitFor({ state: 'visible' })

  const newMistakes = await db`
    select id::text
    from sr_textbook_mistakes
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and exercise_number = ${EXERCISE}
      and id > ${Number(mistakeBaseline.id)}
    order by id desc
  `
  assert(newMistakes.length === 1, `expected one new mistake, got ${newMistakes.length}`)
  createdMistakeId = Number(newMistakes[0].id)
  const wrongEvents = await db`
    select id::text
    from sr_content_answer_events
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and kind = 'exercise'
      and node_id = ${EXERCISE}
      and answer_text = ${WRONG_ANSWER}
      and id > ${Number(eventBaseline.id)}
    order by id desc
  `
  assert(wrongEvents.length === 1, `expected one wrong event, got ${wrongEvents.length}`)
  createdEventIds.push(Number(wrongEvents[0].id))

  await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' })
  const afterWrong = await summary()
  assert(afterWrong.total === before.total + 1, 'wrong answer did not increase total')
  assert(afterWrong.corrected === before.corrected, 'wrong answer changed corrected count')
  assert(
    (await page.locator('[data-mistake-summary]').innerText()).trim() ===
      `${afterWrong.corrected} / ${afterWrong.total}`,
    'app-home wrong-answer ratio does not match the database after a wrong answer',
  )
  await assertMobileShell(page, '.sr-section-gap:last-child')
  await page.screenshot({ path: path.join(shots, 'learn-mobile-wrong.png') })

  await page.goto(`${BASE}/card/${LESSON_ID}?tab=ex&exercise=${EXERCISE}`, {
    waitUntil: 'networkidle',
  })
  const redo = page.locator(`#ex-${EXERCISE}`)
  await setMathValue(redo, correctAnswer)
  await redo.locator('.sr-math-submit').click()
  await redo.locator('.sr-math-result.correct').waitFor({ state: 'visible' })
  const correctEvents = await db`
    select id::text
    from sr_content_answer_events
    where user_id = ${USER_ID}
      and lesson_id = ${LESSON_ID}
      and kind = 'exercise'
      and node_id = ${EXERCISE}
      and is_correct
      and id > ${createdEventIds[0]}
    order by id
  `
  assert(correctEvents.length === 1, 'correct redo did not create one correct event')
  createdEventIds.push(Number(correctEvents[0].id))

  await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' })
  const afterCorrect = await summary()
  assert(afterCorrect.total === afterWrong.total, 'correct redo changed total mistakes')
  assert(
    afterCorrect.corrected === afterWrong.corrected + 1,
    'correct redo did not increase corrected mistakes',
  )
  assert(
    (await page.locator('[data-mistake-summary]').innerText()).trim() ===
      `${afterCorrect.corrected} / ${afterCorrect.total}`,
    'app-home wrong-answer ratio does not match the database after correction',
  )
  await page.screenshot({ path: path.join(shots, 'learn-mobile-corrected.png') })

  await page.goto(`${BASE}/card/${LESSON_ID}?tab=ex`, { waitUntil: 'networkidle' })
  await assertMobileShell(page, '.sr-deck-actions')
  await page.screenshot({ path: path.join(shots, 'card-mobile-bottom.png') })
  console.log('PASS AC2: mobile bars/bottom and corrected/total app-home card verified')
} finally {
  await browser.close()
  if (createdMistakeId != null) {
    await db`delete from sr_textbook_mistakes where id = ${createdMistakeId}`
  }
  for (const id of createdEventIds) {
    await db`delete from sr_content_answer_events where id = ${id}`
  }
  await db.end()
}
