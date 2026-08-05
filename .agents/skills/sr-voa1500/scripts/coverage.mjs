#!/usr/bin/env node
// sr-voa1500 — VOA1500 coverage report across the saved short-text lessons
// (STEMROBIN-80). This is the artifact that decides STEMROBIN-81's acceptance:
// "core wordlist 100% covered, core words appearing in >= 3 distinct lessons".
//
// It reports the truth, including a shortfall — the batch ruling is that an
// unreachable 100% ABORTS to the human rather than silently relaxing the constraint,
// so this script must never round a gap away.
//
// Usage (from repo root):
//   node .agents/skills/sr-voa1500/scripts/coverage.mjs [--json <out.json>]
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadVocab, checkPassage, repoRoot } from './vocab.mjs'
import { contentSql, readRepoEnv } from '../../lib/content-db.mjs'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }

const root = repoRoot()
const sql = contentSql({ max: 2, env: readRepoEnv(root) })

const vocab = loadVocab()
const rows = await sql`
  select id, title, content from sr_lessons where subject = 'english' order by stage, lesson_order
`
await sql.end()

// entry key -> set of lesson ids containing it
const seen = new Map()
const perLesson = []
for (const r of rows) {
  const text = (r.content?.sentences ?? []).map((s) => s.text).join(' ')
  const { covered, oov } = checkPassage(text, vocab, r.content?.properNames ?? [])
  perLesson.push({ id: r.id, title: r.title, entries: covered.size, oov: [...new Set(oov)] })
  for (const k of covered) {
    if (!seen.has(k)) seen.set(k, new Set())
    seen.get(k).add(r.id)
  }
}

const total = vocab.entryKeys.length
const uncovered = vocab.entryKeys.filter((k) => !seen.has(k))
const under3 = [...seen.entries()].filter(([, ls]) => ls.size < 3).map(([k]) => k)
const pct = ((total - uncovered.length) / total * 100)

console.log(`课文数: ${rows.length}`)
for (const l of perLesson) {
  console.log(`  ${l.id.padEnd(20)} ${String(l.entries).padStart(4)} 词条` + (l.oov.length ? `  ⚠ 超表: ${l.oov.join(', ')}` : ''))
}
console.log(`\n目标词表: ${total} 条`)
console.log(`已覆盖:   ${total - uncovered.length} 条 (${pct.toFixed(2)}%)`)
console.log(`未覆盖:   ${uncovered.length} 条`)
console.log(`复现 <3 篇: ${under3.length} 条`)
if (rows.length > 0 && uncovered.length > 0) {
  console.log(`\n未覆盖示例 (前 30): ${uncovered.slice(0, 30).join(', ')}`)
}

if (args.json) {
  writeFileSync(args.json, JSON.stringify({
    lessons: rows.length, totalEntries: total,
    coveredEntries: total - uncovered.length, coveragePct: Number(pct.toFixed(4)),
    uncovered, under3, perLesson,
  }, null, 2))
  console.log(`\n→ ${args.json}`)
}
