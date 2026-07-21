#!/usr/bin/env node
// sr-voa1500 — generation state store (STEMROBIN-93).
//
// What belongs here and what does NOT, because this is the one rule that keeps the
// store honest (charter · SSOT):
//   * IN — things that cannot be derived: which lesson a word is PLANNED for, whether
//     it has been dealt with, where it was rehomed from/to and WHY, and the history of
//     generation actions.
//   * OUT — anything derivable from the real lessons: which words were actually taught,
//     coverage percentages, recurrence counts. Those are computed from the content in
//     Postgres (see coverage.mjs). Storing them here would create a second truth that
//     silently goes stale the moment a passage is edited.
//
// `reconcile()` is the bridge: it reads what was ACTUALLY taught from Postgres and
// updates each assignment's state, so the plan learns what really happened instead of
// asserting it.
//
// Uses node:sqlite (built into Node 24) — no new dependency.
//
// Usage (from repo root):
//   node .agents/skills/sr-voa1500/scripts/state.mjs init      # create + seed words
//   node .agents/skills/sr-voa1500/scripts/state.mjs import <allocation.json>
//   node .agents/skills/sr-voa1500/scripts/state.mjs reconcile # compare against real lessons
//   node .agents/skills/sr-voa1500/scripts/state.mjs word <w>  # one word's status + history
//   node .agents/skills/sr-voa1500/scripts/state.mjs orphans   # planned but not taught
//   node .agents/skills/sr-voa1500/scripts/state.mjs export    # write reviewable snapshot
//   node .agents/skills/sr-voa1500/scripts/state.mjs report
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './vocab.mjs'

const ROOT = repoRoot()
export const DB_PATH = join(ROOT, '.agents/skills/sr-voa1500/state.db')
const SNAPSHOT = join(ROOT, '.agents/skills/sr-voa1500/allocation.json')
const WORDLIST = join(ROOT, 'resources/content/voa1500-wordlist.json')

export function open() {
  const db = new DatabaseSync(DB_PATH)
  db.exec(`
    PRAGMA journal_mode = DELETE;         -- keep it a single file, friendly to git
    CREATE TABLE IF NOT EXISTS word (
      word       TEXT PRIMARY KEY,
      pos        TEXT,
      definition TEXT
    );
    CREATE TABLE IF NOT EXISTS lesson (
      n      INTEGER PRIMARY KEY,
      unit   INTEGER,
      title  TEXT,
      scene  TEXT,
      form   TEXT,
      status TEXT NOT NULL DEFAULT 'planned'   -- planned | written
    );
    -- One row per word: where it is planned to be taught, and how that is going.
    -- state: planned  -> assigned, lesson not written yet
    --        taught   -> the written lesson really teaches it (set by reconcile)
    --        orphaned -> its lesson is written but skipped it; needs rehoming
    --        rehomed  -> moved to another lesson (moved_from records where from)
    CREATE TABLE IF NOT EXISTS assignment (
      word       TEXT PRIMARY KEY REFERENCES word(word),
      lesson_n   INTEGER,
      kind       TEXT NOT NULL DEFAULT 'target',  -- target | incidental
      state      TEXT NOT NULL DEFAULT 'planned',
      moved_from INTEGER,
      note       TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS log (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      at     TEXT NOT NULL DEFAULT (datetime('now')),
      word   TEXT,
      lesson_n INTEGER,
      action TEXT NOT NULL,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS assignment_lesson_idx ON assignment (lesson_n);
    CREATE INDEX IF NOT EXISTS log_word_idx ON log (word);
  `)
  return db
}

export function logAction(db, { word = null, lesson = null, action, detail = null }) {
  db.prepare('INSERT INTO log (word, lesson_n, action, detail) VALUES (?, ?, ?, ?)')
    .run(word, lesson, action, detail)
}

// Seed the 1541 words. Idempotent.
export function initWords(db) {
  const wl = JSON.parse(readFileSync(WORDLIST, 'utf8'))
  const ins = db.prepare('INSERT OR IGNORE INTO word (word, pos, definition) VALUES (?, ?, ?)')
  for (const e of wl.entries) ins.run(e.word.toLowerCase(), e.pos, e.definition)
  return db.prepare('SELECT count(*) c FROM word').get().c
}

// Load a plan (allocation.json shape) into assignments. Existing states are preserved
// for words whose lesson has not changed, so re-importing a refreshed plan does not
// erase what already happened.
export function importPlan(db, path) {
  const plan = JSON.parse(readFileSync(path, 'utf8'))
  const cur = new Map(db.prepare('SELECT word, lesson_n, state FROM assignment').all().map((r) => [r.word, r]))
  const up = db.prepare(`
    INSERT INTO assignment (word, lesson_n, kind, state, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(word) DO UPDATE SET lesson_n = excluded.lesson_n, kind = excluded.kind,
      state = excluded.state, updated_at = datetime('now')
  `)
  let moved = 0
  const put = (w, n, kind) => {
    const k = w.toLowerCase()
    const prev = cur.get(k)
    // keep a finished state if the word stays where it was
    const state = prev && prev.lesson_n === n && prev.state !== 'planned' ? prev.state : 'planned'
    if (prev && prev.lesson_n !== n) {
      moved++
      logAction(db, { word: k, lesson: n, action: 'replan', detail: `L${prev.lesson_n} -> L${n}` })
    }
    up.run(k, n, kind, state)
  }
  for (const l of plan.lessons ?? []) for (const w of l.targets ?? []) put(w, l.n, 'target')
  for (const [w, n] of Object.entries(plan.incidental ?? {})) put(w, n, 'incidental')
  return { assigned: db.prepare('SELECT count(*) c FROM assignment').get().c, moved }
}

// Record a rehoming decision — the one thing that is genuinely not derivable.
export function rehome(db, word, toLesson, note) {
  const w = word.toLowerCase()
  const cur = db.prepare('SELECT lesson_n FROM assignment WHERE word = ?').get(w)
  if (!cur) throw new Error(`未分配的词: ${word}`)
  db.prepare(`UPDATE assignment SET lesson_n = ?, moved_from = ?, state = 'rehomed',
              note = ?, updated_at = datetime('now') WHERE word = ?`)
    .run(toLesson, cur.lesson_n, note ?? null, w)
  logAction(db, { word: w, lesson: toLesson, action: 'rehome', detail: `L${cur.lesson_n} -> L${toLesson}: ${note ?? ''}` })
  return { from: cur.lesson_n, to: toLesson }
}

// Bridge to reality: read what the written lessons ACTUALLY teach and update states.
// Words whose lesson is written but which it skipped become `orphaned`.
export async function reconcile(db) {
  const env = {}
  const envPath = join(ROOT, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2]
    }
  }
  const url = env.EASYAPP_DATABASE_URL || env.DATABASE_URL
  if (!url) throw new Error('no DB url in .env')
  const { default: postgres } = await import('postgres')
  const sql = postgres(url, { ssl: 'require', max: 2, idle_timeout: 20, connection: { search_path: '"stemrobin-schema"' } })
  let rows
  try {
    rows = await sql`select id, lesson_order, content from sr_lessons where subject = 'english'`
  } finally { await sql.end() }

  const taughtByLesson = new Map() // lesson n -> Set(entry keys actually taught)
  for (const r of rows) {
    const keys = new Set((r.content?.vocab ?? []).map((v) => v.key).filter(Boolean))
    taughtByLesson.set(r.lesson_order, keys)
  }
  // mark lessons written
  const setLesson = db.prepare(`INSERT INTO lesson (n, status) VALUES (?, 'written')
                                ON CONFLICT(n) DO UPDATE SET status='written'`)
  for (const n of taughtByLesson.keys()) setLesson.run(n)

  const setState = db.prepare(`UPDATE assignment SET state = ?, updated_at = datetime('now') WHERE word = ?`)
  let taught = 0, orphaned = 0
  for (const a of db.prepare("SELECT word, lesson_n, kind, state FROM assignment WHERE kind = 'target'").all()) {
    const written = taughtByLesson.get(a.lesson_n)
    if (!written) continue                       // its lesson is not written yet
    if (written.has(a.word)) { setState.run('taught', a.word); taught++ }
    else if (a.state !== 'rehomed') { setState.run('orphaned', a.word); orphaned++ }
  }
  logAction(db, { action: 'reconcile', detail: `written lessons=${taughtByLesson.size} taught=${taught} orphaned=${orphaned}` })
  return { writtenLessons: taughtByLesson.size, taught, orphaned }
}

// Reviewable snapshot, because a binary db cannot be read in a diff.
export function exportSnapshot(db) {
  const lessons = new Map()
  for (const r of db.prepare("SELECT word, lesson_n FROM assignment WHERE kind='target' ORDER BY lesson_n, word").all()) {
    if (!lessons.has(r.lesson_n)) lessons.set(r.lesson_n, [])
    lessons.get(r.lesson_n).push(r.word)
  }
  const incidental = {}
  for (const r of db.prepare("SELECT word, lesson_n FROM assignment WHERE kind='incidental' ORDER BY word").all())
    incidental[r.word] = r.lesson_n
  const doc = {
    generated: 'state.mjs export — reviewable snapshot of state.db; state.db is the source of truth',
    lessons: [...lessons.entries()].sort((a, b) => a[0] - b[0]).map(([n, targets]) => ({ n, targets })),
    incidental,
  }
  writeFileSync(SNAPSHOT, JSON.stringify(doc, null, 1))
  return { lessons: doc.lessons.length, incidental: Object.keys(incidental).length }
}

// ── CLI ──
if (process.argv[1] && process.argv[1].endsWith('state.mjs')) {
  const [cmd, ...rest] = process.argv.slice(2)
  const db = open()
  if (cmd === 'init') {
    console.log(`✓ 词条 ${initWords(db)} 条已载入 ${DB_PATH}`)
  } else if (cmd === 'import') {
    const r = importPlan(db, rest[0] ?? SNAPSHOT)
    console.log(`✓ 分配 ${r.assigned} 条${r.moved ? `（其中 ${r.moved} 条换了课次）` : ''}`)
  } else if (cmd === 'reconcile') {
    const r = await reconcile(db)
    console.log(`✓ 对账：已写 ${r.writtenLessons} 课 / 实教 ${r.taught} 词 / 孤儿 ${r.orphaned} 词`)
  } else if (cmd === 'word') {
    const w = (rest[0] ?? '').toLowerCase()
    const a = db.prepare('SELECT * FROM assignment WHERE word = ?').get(w)
    if (!a) { console.log(`"${w}" 未分配`); }
    else {
      console.log(`${w}: 第 ${a.lesson_n} 课 · ${a.kind} · ${a.state}` +
        (a.moved_from ? ` （原属第 ${a.moved_from} 课）` : '') + (a.note ? ` — ${a.note}` : ''))
      for (const l of db.prepare('SELECT at, action, detail FROM log WHERE word = ? ORDER BY id').all(w))
        console.log(`   ${l.at}  ${l.action}  ${l.detail ?? ''}`)
    }
  } else if (cmd === 'orphans') {
    const rows = db.prepare("SELECT word, lesson_n FROM assignment WHERE state='orphaned' ORDER BY lesson_n, word").all()
    console.log(`孤儿词 ${rows.length} 个`)
    for (const r of rows) console.log(`  L${r.lesson_n}  ${r.word}`)
  } else if (cmd === 'export') {
    const r = exportSnapshot(db)
    console.log(`✓ 快照已导出：${r.lessons} 课 / ${r.incidental} 随文词`)
  } else if (cmd === 'report') {
    const by = db.prepare('SELECT state, count(*) c FROM assignment GROUP BY state').all()
    console.log('词条', db.prepare('SELECT count(*) c FROM word').get().c,
      '| 已分配', db.prepare('SELECT count(*) c FROM assignment').get().c)
    for (const r of by) console.log(`  ${r.state}: ${r.c}`)
  } else {
    console.error('用法: state.mjs init|import <plan>|reconcile|word <w>|orphans|export|report')
    process.exit(1)
  }
  db.close()
}
