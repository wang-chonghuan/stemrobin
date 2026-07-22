#!/usr/bin/env node
// sr-voa1500 — 保存即对账：the plan learns what the passage actually taught (STEMROBIN-96).
//
// The failure this exists to kill: a lesson is written, the words it was PLANNED to teach
// are quietly not in it, and nobody notices until the course is finished. Measured on two
// lessons it was 16 words; extrapolated over 84 lessons, ~480 words would never be taught.
//
// So every save reconciles the passage against the plan in
// resources/content/course-wordlist.json (the single source of truth) and each planned
// word ends in a state that is never silently "gone":
//
//   taught    — the passage really covers it
//   orphaned  — planned here, the lesson is written, the passage skipped it → needs a
//               disposition (write it in / rehome it / defer it). Never silent.
//   rehomed   — moved to another, still-unwritten lesson (movedFrom keeps the origin)
//   deferred  — explicitly parked: no better lesson exists yet
//
// Coverage %, recurrence counts and "which words a lesson taught" are NOT stored here —
// they are derived from the real lessons by coverage.mjs (charter · SSOT).
//
// Usage (from repo root):
//   node .agents/skills/sr-voa1500/scripts/reconcile.mjs --lesson english-u01-01
//   node .agents/skills/sr-voa1500/scripts/reconcile.mjs --rehome grandmother=english-u01-07,uncle=english-u01-07
//   node .agents/skills/sr-voa1500/scripts/reconcile.mjs --defer moon --why "本单元无更合适场景"
//   node .agents/skills/sr-voa1500/scripts/reconcile.mjs --status
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './vocab.mjs'

const WORDLIST = 'resources/content/course-wordlist.json'
const UNITS = 12
const PER_UNIT = 7

// The 84 lesson ids of the blueprint, in course order. Unit u holds orders
// (u-1)*7+1 … u*7, and the id carries both so it sorts and reads correctly.
export function allLessonIds() {
  const out = []
  for (let u = 1; u <= UNITS; u++) {
    for (let i = 1; i <= PER_UNIT; i++) {
      out.push(`english-u${String(u).padStart(2, '0')}-${String((u - 1) * PER_UNIT + i).padStart(2, '0')}`)
    }
  }
  return out
}

export function loadWordlist() {
  const path = join(repoRoot(), WORDLIST)
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  return { path, doc, byWord: new Map(doc.words.map((w) => [w.word.toLowerCase(), w])) }
}

export function saveWordlist({ path, doc }) {
  doc.counts = {
    total: doc.words.length,
    byLevel: doc.words.reduce((m, w) => ((m[w.level] = (m[w.level] ?? 0) + 1), m), {}),
    bySource: doc.words.reduce((m, w) => ((m[w.source] = (m[w.source] ?? 0) + 1), m), {}),
  }
  writeFileSync(path, JSON.stringify(doc, null, 1) + '\n')
}

// The first lesson after `lessonId` that has not been written yet — where an orphan can
// still be taught. null when this is the last unwritten lesson of the course.
export function suggestHome(lessonId, written) {
  const ids = allLessonIds()
  return ids.slice(ids.indexOf(lessonId) + 1).find((id) => !written.has(id)) ?? null
}

// Reconcile one just-saved lesson against the plan. Mutates the wordlist doc and writes it.
//   coveredKeys — wordlist entry keys the passage actually covers (from the gate)
//   targets     — the entry keys this lesson puts on a 生词卡
//   written     — lesson ids that already exist in the DB (this one included)
export function reconcileLesson({ lessonId, coveredKeys, targets, written }) {
  const wl = loadWordlist()
  const covered = new Set(coveredKeys)
  const planned = wl.doc.words.filter((w) => w.lesson === lessonId && w.state !== 'rehomed')
  const taught = []
  const orphans = []
  for (const e of planned) {
    if (covered.has(e.word.toLowerCase())) { e.state = 'taught'; taught.push(e.word) }
    else { e.state = 'orphaned'; orphans.push(e) }
  }
  // Words this lesson actually puts on a card but that the plan did not expect here:
  // either未分配 (the plan simply learns) or planned for a lesson not yet written (the
  // word is taught HERE now, so the plan follows the reality instead of teaching twice).
  const adopted = []
  for (const key of targets) {
    const e = wl.byWord.get(key)
    if (!e || e.lesson === lessonId) continue
    if (e.lesson && written.has(e.lesson)) continue // already taught earlier — a review word
    adopted.push({ word: e.word, from: e.lesson })
    e.movedFrom = e.lesson
    e.lesson = lessonId
    e.state = 'taught'
  }
  const suggestion = suggestHome(lessonId, written)
  saveWordlist(wl)
  return {
    plannedCount: planned.length,
    taught,
    adopted,
    orphans: orphans.map((e) => ({ word: e.word, suggest: suggestion })),
  }
}

// Every planned word that is still without a home after its lesson was written.
export function openOrphans() {
  const { doc } = loadWordlist()
  return doc.words.filter((w) => w.state === 'orphaned')
}

export function printReconcileReport(r, lessonId) {
  console.log(`· 对账 ${lessonId} — 计划 ${r.plannedCount} 词 / 实教 ${r.taught.length} 词`)
  if (r.adopted.length)
    console.log(`  收养 ${r.adopted.length} 词（原属 ${[...new Set(r.adopted.map((a) => a.from ?? '未分配'))].join(', ')}）: ${r.adopted.map((a) => a.word).join(', ')}`)
  if (r.orphans.length) {
    console.log(`  ⚠ 漏词 ${r.orphans.length} 个，须显式处置（写进正文 / 改嫁 / 记录待定）:`)
    for (const o of r.orphans) console.log(`    ${o.word.padEnd(14)} 建议改嫁 → ${o.suggest ?? '（无未写课次，只能 --defer）'}`)
    console.log(`    处置: node .agents/skills/sr-voa1500/scripts/reconcile.mjs --rehome ${r.orphans.map((o) => `${o.word}=${o.suggest ?? 'LESSON'}`).join(',')}`)
  } else if (r.plannedCount) {
    console.log('  ✓ 无漏词')
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }

  if (argv.includes('--status')) {
    const { doc } = loadWordlist()
    const by = doc.words.reduce((m, w) => ((m[w.state] = (m[w.state] ?? 0) + 1), m), {})
    console.log('词表状态:', JSON.stringify(by))
    const open = doc.words.filter((w) => w.state === 'orphaned')
    for (const w of open) console.log(`  待处置 ${w.word} (原属 ${w.lesson})`)
    process.exit(open.length ? 1 : 0)
  }

  if (arg('--rehome') || arg('--defer')) {
    const wl = loadWordlist()
    const why = arg('--why') ?? null
    const done = []
    for (const pair of (arg('--rehome') ?? '').split(',').filter(Boolean)) {
      const [word, to] = pair.split('=')
      const e = wl.byWord.get(word.toLowerCase())
      if (!e) { console.error(`✗ "${word}" 不在词表`); process.exit(1) }
      if (!allLessonIds().includes(to)) { console.error(`✗ "${to}" 不是课次 id`); process.exit(1) }
      e.movedFrom = e.lesson
      e.lesson = to
      e.state = 'planned'
      done.push(`${e.word}: ${e.movedFrom} → ${to}`)
    }
    for (const word of (arg('--defer') ?? '').split(',').filter(Boolean)) {
      const e = wl.byWord.get(word.toLowerCase())
      if (!e) { console.error(`✗ "${word}" 不在词表`); process.exit(1) }
      e.movedFrom = e.lesson
      e.lesson = null
      e.state = 'deferred'
      done.push(`${e.word}: ${e.movedFrom} → 待定`)
    }
    wl.doc.log = [...(wl.doc.log ?? []), {
      date: new Date().toISOString().slice(0, 10),
      ticket: 'STEMROBIN-96', action: '漏词处置' + (why ? `：${why}` : ''), words: done,
    }]
    saveWordlist(wl)
    for (const d of done) console.log(`✓ ${d}`)
    process.exit(0)
  }

  const lessonId = arg('--lesson')
  if (!lessonId) { console.error('用法: --lesson <id> | --rehome w=lesson,… | --defer w,… | --status'); process.exit(1) }

  // Reconciling out of band reads what the lesson really teaches from the DB.
  const root = repoRoot()
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) { console.error('✗ .env not found at repo root'); process.exit(1) }
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]
  }
  const postgres = (await import('postgres')).default
  const sql = postgres(env.EASYAPP_DATABASE_URL || env.DATABASE_URL, {
    ssl: 'require', max: 2, idle_timeout: 20, connection: { search_path: '"stemrobin-schema"' },
  })
  try {
    const rows = await sql`select id, content from sr_lessons where subject = 'english'`
    const row = rows.find((r) => r.id === lessonId)
    if (!row) { console.error(`✗ ${lessonId} 尚未写入数据库`); process.exit(1) }
    const r = reconcileLesson({
      lessonId,
      coveredKeys: row.content.coveredKeys ?? [],
      targets: (row.content.vocab ?? []).map((v) => v.key),
      written: new Set(rows.map((x) => x.id)),
    })
    printReconcileReport(r, lessonId)
    process.exit(r.orphans.length ? 1 : 0)
  } finally { await sql.end() }
}
