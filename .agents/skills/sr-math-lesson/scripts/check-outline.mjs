#!/usr/bin/env node
// sr-math-lesson — checks that a stage ledger still covers the human math
// outline in order. The ledger may add prerequisite anatomy lessons, but it
// may not rename, replace, or reorder the guide's lessons.
//
// Usage:
//   node check-outline.mjs resources/content/course-gen-guide-math.md \
//     --ledger resources/content/math-ledger/stage-3.json [--id math-s3-01]
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function fail(messages) {
  console.error('✗ outline check failed:')
  for (const message of messages) console.error(`  - ${message}`)
  process.exit(1)
}

const [guidePath, ...rest] = process.argv.slice(2)
if (!guidePath) {
  console.error('usage: check-outline.mjs <course-guide.md> --ledger <stage-ledger.json> [--id <lesson-id>]')
  process.exit(2)
}

const options = {}
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    options[rest[i].slice(2)] = rest[i + 1]
    i++
  }
}
if (!options.ledger) fail(['--ledger is required'])

function read(path, label) {
  const absolute = resolve(process.cwd(), path)
  if (!existsSync(absolute)) fail([`${label} not found: ${path}`])
  return { absolute, contents: readFileSync(absolute, 'utf8') }
}

const guide = read(guidePath, 'course guide')
const ledgerFile = read(options.ledger, 'ledger')
let ledger
try {
  ledger = JSON.parse(ledgerFile.contents)
} catch (error) {
  fail([`ledger JSON parse error: ${error.message}`])
}

const stageHeading = new RegExp(`^### 第[一二三四五六七八九十]+阶段：(.+)$`, 'm')
const stageHeadings = [...guide.contents.matchAll(new RegExp(stageHeading, 'gm'))]
const target = stageHeadings.find((match) => {
  const start = match.index ?? 0
  const before = guide.contents.slice(0, start)
  return (before.match(/^### 第[一二三四五六七八九十]+阶段：/gm) || []).length + 1 === ledger.stage
})

if (!target) fail([`course guide has no stage ${ledger.stage} heading`])

const start = (target.index ?? 0) + target[0].length
const nextHeading = guide.contents.indexOf('\n### ', start)
const stageBody = guide.contents.slice(start, nextHeading === -1 ? undefined : nextHeading)
const outlineLessons = [...stageBody.matchAll(/^\d+\.\s+(.+?)\s*$/gm)].map((match) => match[1])
const problems = []

if (target[1].trim() !== String(ledger.theme ?? '').trim()) {
  problems.push(`ledger theme "${ledger.theme ?? 'missing'}" does not match guide stage "${target[1].trim()}"`)
}
if (!outlineLessons.length) problems.push(`course guide stage ${ledger.stage} has no numbered lessons`)

let previousIndex = -1
for (const title of outlineLessons) {
  const matches = (ledger.lessons ?? [])
    .map((lesson, index) => ({ lesson, index }))
    .filter(({ lesson }) => lesson.title === title)
  if (!matches.length) {
    problems.push(`guide lesson "${title}" is missing from the ledger`)
    continue
  }
  if (matches.length > 1) {
    problems.push(`guide lesson "${title}" appears ${matches.length} times in the ledger`)
    continue
  }
  if (matches[0].index <= previousIndex) {
    problems.push(`guide lesson "${title}" is out of order in the ledger`)
    continue
  }
  previousIndex = matches[0].index
}

if (options.id) {
  const lesson = (ledger.lessons ?? []).find((entry) => entry.id === options.id)
  if (!lesson) problems.push(`lesson ${options.id} is not in the ledger`)
  else if (!outlineLessons.includes(lesson.title)) {
    problems.push(`lesson ${options.id} title "${lesson.title}" does not exist in the human outline`)
  }
}

if (problems.length) fail(problems)
console.log(`✓ outline ok: stage ${ledger.stage} · ${outlineLessons.length} guide lessons retained in order${options.id ? ` · ${options.id} matches guide` : ''}`)
