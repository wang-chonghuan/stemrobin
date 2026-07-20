#!/usr/bin/env node
// sr-english-reader — deterministic persistence for one short-text English lesson
// (STEMROBIN-80). Validates the passage against the charter's hard constraints,
// pre-renders per-sentence narration via Azure TTS, then writes the neutral content,
// the zh gloss overlay and the audio in one transaction.
//
// The gate REFUSES to save rather than degrade: an out-of-vocabulary word, a passage
// over the word budget, or a missing gloss stops the save with a report. Content is
// never silently relaxed to fit (charter · abort beats workaround).
//
// Usage (from repo root):
//   node .agents/skills/sr-english-reader/scripts/save-lesson.mjs --spec <lesson.json> [--status draft]
//
// Spec shape:
//   { "id":"english-u01-01", "unit":1, "order":1, "title":"...", "theme":"...",
//     "properNames":["Anna"],
//     "sentences":[ { "text":"...", "gloss":"中文", "targets":["walk","school"] } ] }
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadVocab, checkPassage, words, resolve, repoRoot } from './vocab.mjs'
import { synthesize } from './tts.mjs'

function fail(m) { console.error(`✗ ${m}`); process.exit(1) }

const MAX_WORDS = 120
const MIN_SENTENCES = 6
const MAX_SENTENCES = 9

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
if (!args.spec) fail('missing --spec <lesson.json>')

const root = repoRoot()
const spec = JSON.parse(readFileSync(args.spec, 'utf8'))
for (const k of ['id', 'unit', 'order', 'title', 'sentences']) if (spec[k] === undefined) fail(`spec missing "${k}"`)

const envPath = join(root, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]
}
const dbUrl = env.EASYAPP_DATABASE_URL || env.DATABASE_URL
if (!dbUrl) fail('no EASYAPP_DATABASE_URL / DATABASE_URL in .env')

// ── validate ───────────────────────────────────────────────────────────────
const vocab = loadVocab()
const problems = []

if (spec.sentences.length < MIN_SENTENCES || spec.sentences.length > MAX_SENTENCES)
  problems.push(`句数 ${spec.sentences.length}，须在 ${MIN_SENTENCES}–${MAX_SENTENCES} 之间`)

const fullText = spec.sentences.map((s) => s.text).join(' ')
const totalWords = words(fullText).length
if (totalWords > MAX_WORDS) problems.push(`正文 ${totalWords} 词，超出上限 ${MAX_WORDS}`)

const { covered, oov } = checkPassage(fullText, vocab, spec.properNames ?? [])
if (oov.length) problems.push(`超出词表的词 (${oov.length}): ${[...new Set(oov)].join(', ')}`)

spec.sentences.forEach((s, i) => {
  if (!s.text || !s.text.trim()) problems.push(`第 ${i + 1} 句缺 text`)
  if (!s.gloss || !s.gloss.trim()) problems.push(`第 ${i + 1} 句缺中文 gloss`)
  const ws = words(s.text).map((w) => w.toLowerCase())
  for (const t of s.targets ?? []) {
    const hit = ws.findIndex((w) => w === t.toLowerCase() || resolve(w, vocab) === resolve(t, vocab))
    if (hit === -1) problems.push(`第 ${i + 1} 句的目标词 "${t}" 不在该句中`)
  }
})

// 本课生词 (中英对照): every target word introduced by this lesson must carry a
// Chinese meaning, and every listed word must be a real VOA1500 word in the passage.
const targetWords = [...new Set(spec.sentences.flatMap((s) => s.targets ?? []).map((w) => w.toLowerCase()))]
const glossMap = new Map(Object.entries(spec.vocab ?? {}).map(([k, v]) => [k.toLowerCase(), v]))
for (const w of targetWords) {
  if (!glossMap.has(w)) problems.push(`生词 "${w}" 缺中文释义 (spec.vocab)`)
}
for (const w of glossMap.keys()) {
  if (!resolve(w, vocab)) problems.push(`生词 "${w}" 不在 VOA1500 词表`)
}

if (problems.length) {
  console.error('✗ 校验未通过，未写入任何数据：')
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}

// target words -> 0-based word-token indices (the content shape's contract)
const sentences = spec.sentences.map((s, i) => {
  const ws = words(s.text).map((w) => w.toLowerCase())
  const targets = (s.targets ?? []).map((t) =>
    ws.findIndex((w) => w === t.toLowerCase() || resolve(w, vocab) === resolve(t, vocab)),
  ).filter((n) => n >= 0)
  return { id: `s${i + 1}`, num: i + 1, text: s.text.trim(), targets, rev: 1 }
})
// vocab list in first-appearance order across the passage; pos from the wordlist.
const vocabList = targetWords.map((w) => ({
  en: w,
  pos: vocab.pos.get(resolve(w, vocab)) ?? '',
  zh: glossMap.get(w),
}))
const content = { kind: 'short-text', theme: spec.theme ?? null, properNames: spec.properNames ?? [], vocab: vocabList, sentences }
const overlay = Object.fromEntries(spec.sentences.map((s, i) => [`s${i + 1}`, { t: s.gloss.trim(), src_rev: 1 }]))

// ── narrate ────────────────────────────────────────────────────────────────
console.log(`· 合成朗读 ${sentences.length} 句 …`)
const audio = []
for (const s of sentences) {
  audio.push({ node: s.id, bytes: await synthesize(s.text) })
  process.stdout.write(`  ${s.id} ${audio[audio.length - 1].bytes.length}B\n`)
}

// ── persist ────────────────────────────────────────────────────────────────
const sql = postgres(dbUrl, { ssl: 'require', max: 3, idle_timeout: 20, connection: { search_path: '"stemrobin-schema"' } })
try {
  await sql.begin(async (tx) => {
    await tx`
      insert into sr_lessons (id, subject, stage, lesson_order, title, concept, content, status)
      values (${spec.id}, 'english', ${spec.unit}, ${spec.order}, ${spec.title},
              ${spec.theme ?? ''}, ${tx.json(content)}, ${args.status || 'draft'})
      on conflict (id) do update set
        stage = excluded.stage, lesson_order = excluded.lesson_order, title = excluded.title,
        concept = excluded.concept, content = excluded.content, status = excluded.status,
        updated_at = now()
    `
    await tx`
      insert into sr_lesson_i18n (lesson_id, locale, overlay) values (${spec.id}, 'zh', ${tx.json(overlay)})
      on conflict (lesson_id, locale) do update set overlay = excluded.overlay, updated_at = now()
    `
    for (const a of audio) {
      await tx`
        insert into sr_lesson_audio (lesson_id, node_id, mime, bytes, voice)
        values (${spec.id}, ${a.node}, 'audio/mpeg', ${a.bytes}, ${env.AZURE_TTS_VOICE})
        on conflict (lesson_id, node_id) do update set bytes = excluded.bytes, voice = excluded.voice, updated_at = now()
      `
    }
  })
  console.log(`✓ ${spec.id} 已保存 — ${sentences.length} 句 / ${totalWords} 词 / 覆盖 ${covered.size} 个词表词条 / ${audio.length} 段朗读`)
} catch (e) {
  fail(`写库失败: ${e.message}`)
} finally {
  await sql.end()
}
