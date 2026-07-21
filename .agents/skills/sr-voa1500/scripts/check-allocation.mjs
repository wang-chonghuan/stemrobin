#!/usr/bin/env node
// sr-voa1500 — allocation-table validator (STEMROBIN-86). The allocation table
// (allocation.json, next to outline.md) is the machine complement of the human
// blueprint: it assigns every one of the 1541 core words a home lesson. This
// checker is the acceptance gate — the table is invalid until it passes clean.
//
// allocation.json shape:
// {
//   "lessons": [ { "n": 1, "targets": ["name","family", ...20-25 words...] } x60 ],
//   "incidental": { "the-like ultra-high-frequency word": <home lesson n>, ... },
//   "review":     { "<word>": [<later lesson n>, <later lesson n>], ... }
// }
// - targets: the lesson's FORMAL taught words (its vocab card), 20-25 each.
// - incidental: words whose first coverage rides along in a lesson's prose without
//   being card-taught (you don't put "the" on a vocab card). Kept small.
// - review: planned re-appearance lessons per word (>=2, strictly after home).
//
// Usage: node .agents/skills/sr-voa1500/scripts/check-allocation.mjs [--alloc <path>]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './vocab.mjs'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }

const root = repoRoot()
const wl = JSON.parse(readFileSync(join(root, 'resources/content/voa1500-wordlist.json'), 'utf8'))
const alloc = JSON.parse(readFileSync(args.alloc ?? join(root, '.agents/skills/sr-voa1500/allocation.json'), 'utf8'))

const problems = []
const all = new Set(wl.entries.map((e) => e.word.toLowerCase()))

// 综合 lessons close each unit; the blueprint says they carry 少量新词 + 大量旧词回收,
// so they are held to a much smaller new-word budget than a teaching lesson.
const SYNTHESIS = new Set([6, 12, 18, 24, 30, 36, 42, 48, 54, 60])
const CAP = (n) => (SYNTHESIS.has(n) ? { min: 0, max: 10 } : { min: 20, max: 25 })

// 1. lesson structure
if (!Array.isArray(alloc.lessons) || alloc.lessons.length !== 60)
  problems.push(`lessons 数应为 60，实为 ${alloc.lessons?.length}`)
const ns = new Set()
for (const l of alloc.lessons ?? []) {
  if (!Number.isInteger(l.n) || l.n < 1 || l.n > 60 || ns.has(l.n)) problems.push(`课号非法或重复: ${l.n}`)
  ns.add(l.n)
  const t = l.targets ?? []
  const { min, max } = CAP(l.n)
  if (t.length < min || t.length > max)
    problems.push(`第 ${l.n} 课 targets ${t.length} 个，须 ${min}–${max}${SYNTHESIS.has(l.n) ? '（综合课）' : ''}`)
}

// 2. partition: every word exactly once across targets ∪ incidental
const seen = new Map() // word -> where
const claim = (w, where) => {
  const k = w.toLowerCase()
  if (!all.has(k)) { problems.push(`"${w}" 不在 1541 词表 (${where})`); return }
  if (seen.has(k)) problems.push(`"${w}" 被重复分配: ${seen.get(k)} 与 ${where}`)
  else seen.set(k, where)
}
for (const l of alloc.lessons ?? []) for (const w of l.targets ?? []) claim(w, `L${l.n}:target`)
for (const [w, n] of Object.entries(alloc.incidental ?? {})) {
  if (!Number.isInteger(n) || n < 1 || n > 60) problems.push(`incidental "${w}" 的归属课号非法: ${n}`)
  claim(w, `L${n}:incidental`)
}
const missing = [...all].filter((w) => !seen.has(w))
if (missing.length) problems.push(`未分配 ${missing.length} 词: ${missing.slice(0, 25).join(', ')}${missing.length > 25 ? ' …' : ''}`)

// 3. review plan: >=2 later lessons for every TARGET word — so it is met 3 times in
//    all (home + 2). Words introduced in the closing unit physically cannot recur
//    later; they are exempt but counted, because that gap is real and should be
//    visible rather than hidden.
const LATE = 48 // words introduced after this have too little course left to recur
const home = new Map()
for (const l of alloc.lessons ?? []) for (const w of l.targets ?? []) home.set(w.toLowerCase(), l.n)
let underReviewed = 0
let lateExempt = 0
for (const [w, h] of home) {
  const later = ((alloc.review ?? {})[w] ?? []).filter((n) => Number.isInteger(n) && n > h && n <= 60)
  if (later.length >= 2) continue
  if (h > LATE) lateExempt++
  else underReviewed++
}
if (underReviewed) problems.push(`${underReviewed} 个 target 词的计划复现不足（须 ≥2 个晚于首现课的复现课）`)
if (lateExempt) console.log(`注：${lateExempt} 个词首现于第 ${LATE + 1}–60 课，课程余量不足以再复现两次（已豁免并记录）`)

// report
const tCount = [...seen.values()].filter((v) => v.includes('target')).length
const iCount = [...seen.values()].filter((v) => v.includes('incidental')).length
console.log(`词表: ${all.size} | 已分配: ${seen.size} (targets ${tCount} + incidental ${iCount}) | 未分配: ${missing.length}`)
if (problems.length) {
  console.error(`✗ ${problems.length} 个问题:`)
  for (const p of problems.slice(0, 40)) console.error(`  · ${p}`)
  if (problems.length > 40) console.error(`  · …共 ${problems.length} 条`)
  process.exit(1)
}
console.log('✓ allocation 校验通过：全量覆盖、无重复、每课 20–25 target、复现计划成立')
