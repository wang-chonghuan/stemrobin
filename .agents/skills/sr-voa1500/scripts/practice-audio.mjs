#!/usr/bin/env node
// sr-voa1500 — 跟读练习音频 (STEMROBIN-107, seed STEMROBIN-106).
//
// One downloadable mp3 per lesson that a child can play away from the screen:
//
//   "Lesson 3. Ready for School."   ← 报课
//   <sentence 1>  …1s…  <sentence 1>       ← 每句连读 REPEATS 遍
//   …2s…
//   <sentence 2>  …1s…  <sentence 2>
//   …
//
// Built by CONCATENATING the clips already stored in sr_lesson_audio and inserting
// silence made of mp3 frames in the same format — no ffmpeg, no audio library, no new
// dependency (charter · 无谓依赖为铁律). The product already concatenates mp3 clips this
// way for a dialogue's whole-passage narration; this only adds the silence.
//
// A silent frame is the clip's own frame header followed by a zeroed frame body: the
// decoder reads a valid Layer III frame whose granules are empty and outputs silence.
// Verified empirically: a track computed at 23.8 s decoded to 23.76 s in the browser
// with clean silence between the speech blocks.
//
// Usage (from repo root):
//   node .agents/skills/sr-voa1500/scripts/practice-audio.mjs --lesson english-u01-01
//   node .agents/skills/sr-voa1500/scripts/practice-audio.mjs --all
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './vocab.mjs'
import { synthesize } from './tts.mjs'

// ── the drill's shape — change these, regenerate, the audio changes ──────────
export const PRACTICE_CONFIG = {
  intro: true,              // speak "Lesson <n>. <title>." before the first sentence
  repeats: 2,               // how many times each sentence is read
  gapBetweenRepeats: 1,     // seconds of silence between the repeats of one sentence
  gapAfterSentence: 2,      // seconds of silence before the next sentence
  gapAfterIntro: 2,         // seconds of silence after the spoken lesson title
}

export const PRACTICE_NODE = 'practice'

// mp3 frame arithmetic. Layer III only — that is what the TTS returns and what the
// silence has to match; anything else is an error rather than a guess.
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]

export function readFrameFormat(clip) {
  let i = 0
  while (i < clip.length - 4 && !(clip[i] === 0xff && (clip[i + 1] & 0xe0) === 0xe0)) i++
  if (i >= clip.length - 4) throw new Error('practice-audio: no mp3 frame sync found')
  const h = clip.readUInt32BE(i)
  const version = (h >> 19) & 3          // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  const layer = (h >> 17) & 3            // 1 = Layer III
  if (layer !== 1) throw new Error(`practice-audio: expected Layer III, got layer bits ${layer}`)
  const isV1 = version === 3
  const bitrate = (isV1 ? BITRATES_V1 : BITRATES_V2)[(h >> 12) & 15] * 1000
  const sampleRate = SAMPLE_RATES[version][(h >> 10) & 3]
  if (!bitrate || !sampleRate) throw new Error('practice-audio: unsupported mp3 frame header')
  const samplesPerFrame = isV1 ? 1152 : 576
  return {
    header: clip.subarray(i, i + 4),
    bitrate, sampleRate, samplesPerFrame,
    frameBytes: Math.floor(((isV1 ? 144 : 72) * bitrate) / sampleRate),
    frameSeconds: samplesPerFrame / sampleRate,
  }
}

// Silence of the same format as `fmt`, rounded to whole frames.
function silence(fmt, seconds) {
  const frame = Buffer.concat([fmt.header, Buffer.alloc(fmt.frameBytes - 4)])
  return Buffer.concat(Array(Math.round(seconds / fmt.frameSeconds)).fill(frame))
}

// clips: the per-sentence mp3s in passage order. intro: the spoken title, or null.
export function buildPracticeTrack({ clips, intro = null, cfg = PRACTICE_CONFIG }) {
  if (!clips.length) throw new Error('practice-audio: no sentence clips')
  const fmt = readFrameFormat(intro ?? clips[0])
  const parts = []
  if (intro) parts.push(intro, silence(fmt, cfg.gapAfterIntro))
  for (const clip of clips) {
    for (let i = 0; i < cfg.repeats; i++) {
      parts.push(clip)
      if (i < cfg.repeats - 1) parts.push(silence(fmt, cfg.gapBetweenRepeats))
    }
    parts.push(silence(fmt, cfg.gapAfterSentence))
  }
  const bytes = Buffer.concat(parts)
  // CBR, so the duration is exact arithmetic rather than a guess.
  return { bytes, seconds: bytes.length / (fmt.bitrate / 8), fmt }
}

export const introText = (order, title) => `Lesson ${order}. ${title}.`

// ── CLI: backfill lessons whose audio predates this feature ─────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2)
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const only = arg('--lesson')
  if (!only && !argv.includes('--all')) {
    console.error('用法: practice-audio.mjs --lesson <id> | --all')
    process.exit(1)
  }

  const root = repoRoot()
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) { console.error('✗ .env not found at repo root'); process.exit(1) }
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]
  }
  const postgres = (await import('postgres')).default
  const sql = postgres(env.EASYAPP_DATABASE_URL || env.DATABASE_URL, {
    ssl: 'require', max: 3, idle_timeout: 20, connection: { search_path: '"stemrobin-schema"' },
  })
  try {
    const lessons = await sql`
      select id, lesson_order, title, content from sr_lessons
      where subject = 'english' ${only ? sql`and id = ${only}` : sql``}
      order by stage, lesson_order
    `
    if (!lessons.length) { console.error(`✗ 没有匹配的英语课文${only ? `: ${only}` : ''}`); process.exit(1) }
    for (const lesson of lessons) {
      const rows = await sql`select node_id, bytes from sr_lesson_audio where lesson_id = ${lesson.id}`
      const byNode = new Map(rows.map((r) => [r.node_id, Buffer.from(r.bytes)]))
      const clips = lesson.content.sentences.map((s) => byNode.get(s.id))
      if (clips.some((c) => !c)) { console.error(`✗ ${lesson.id} 缺句子音频，先重新保存课文`); process.exit(1) }
      const intro = PRACTICE_CONFIG.intro
        ? await synthesize(introText(lesson.lesson_order, lesson.title), { voice: env.AZURE_TTS_VOICE })
        : null
      const { bytes, seconds } = buildPracticeTrack({ clips, intro })
      await sql`
        insert into sr_lesson_audio (lesson_id, node_id, mime, bytes, voice)
        values (${lesson.id}, ${PRACTICE_NODE}, 'audio/mpeg', ${bytes}, ${env.AZURE_TTS_VOICE})
        on conflict (lesson_id, node_id) do update set bytes = excluded.bytes, voice = excluded.voice, updated_at = now()
      `
      console.log(`✓ ${lesson.id} — ${clips.length} 句 ×${PRACTICE_CONFIG.repeats} 遍 / ${Math.round(seconds)} 秒 / ${Math.round(bytes.length / 1024)} KB`)
    }
  } finally { await sql.end() }
}
