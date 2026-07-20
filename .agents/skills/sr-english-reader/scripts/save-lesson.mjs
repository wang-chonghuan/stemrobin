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
// vocab list in first-appearance order; pos + entry-key from the wordlist. `key` is
// the VOA headword ("hungry" -> "hunger"), so the app can match the same word across
// lessons for the new-vs-review split.
const vocabList = targetWords.map((w) => ({
  en: w,
  key: resolve(w, vocab),
  pos: vocab.pos.get(resolve(w, vocab)) ?? '',
  zh: glossMap.get(w),
}))
// The VOA entry-keys the whole passage covers — the app intersects this with earlier
// lessons' vocab keys to find which words are review words.
const coveredKeys = [...covered].sort()
const content = { kind: 'short-text', theme: spec.theme ?? null, properNames: spec.properNames ?? [], vocab: vocabList, coveredKeys, sentences }
const overlay = Object.fromEntries(spec.sentences.map((s, i) => [`s${i + 1}`, { t: s.gloss.trim(), src_rev: 1 }]))

// ── print PDF (English + 中文 + 生词, downloadable like a math lesson) ────────
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) }
function printHtml() {
  const rows = spec.sentences
    .map((s, i) => `<div class="s"><div class="n">${i + 1}</div><div><p class="en">${esc(s.text)}</p><p class="zh">${esc(s.gloss)}</p></div></div>`)
    .join('')
  const vrows = vocabList
    .map((v) => `<div class="v"><span class="ve">${esc(v.en)}</span><span class="vz">${esc(v.zh)}</span></div>`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: -apple-system, "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif; color: #15201F; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .lead { color: #8A9795; font-size: 12px; margin: 0 0 16px; }
    .s { display: flex; gap: 10px; padding: 9px 0; border-top: 1px solid #EEF3F2; }
    .s:first-of-type { border-top: 0; }
    .n { color: #8A9795; font-size: 12px; min-width: 18px; }
    .en { font-size: 15px; margin: 0 0 3px; }
    .zh { font-size: 13px; color: #4C5A58; margin: 0; }
    h2 { font-size: 13px; margin: 20px 0 8px; }
    .vlist { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; }
    .v { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid #EEF3F2; }
    .ve { font-weight: 600; color: #0A5E76; font-size: 13px; }
    .vz { color: #4C5A58; font-size: 13px; }
  </style></head><body>
    <h1>${spec.order}. ${esc(spec.title)}</h1>
    <p class="lead">VOA1500 · ${esc(spec.theme ?? '')}</p>
    ${rows}
    <h2>本课生词</h2>
    <div class="vlist">${vrows}</div>
  </body></html>`
}

let pdf = null
try {
  const { chromium } = await import('playwright-core')
  let browser
  try { browser = await chromium.launch() } catch { browser = await chromium.launch({ channel: 'chrome' }) }
  try {
    const page = await browser.newPage()
    await page.setContent(printHtml(), { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready.then(() => true))
    await page.emulateMedia({ media: 'print' })
    pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
  } finally { await browser.close() }
  console.log(`· PDF 生成 (${Math.round((pdf?.length ?? 0) / 1024)} KB)`)
} catch (e) {
  fail(`PDF 生成失败: ${(e && e.message) || e}`)
}

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
      insert into sr_lessons (id, subject, stage, lesson_order, title, concept, content, pdf, status)
      values (${spec.id}, 'english', ${spec.unit}, ${spec.order}, ${spec.title},
              ${spec.theme ?? ''}, ${tx.json(content)}, ${pdf}, ${args.status || 'draft'})
      on conflict (id) do update set
        stage = excluded.stage, lesson_order = excluded.lesson_order, title = excluded.title,
        concept = excluded.concept, content = excluded.content, pdf = excluded.pdf,
        status = excluded.status, updated_at = now()
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
