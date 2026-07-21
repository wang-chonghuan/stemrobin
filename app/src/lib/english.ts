import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentLocale } from '~/lib/locale.server'

// Short-text English lesson content shape (STEMROBIN-77, batch 0012).
//
// A short-text lesson is a memorizable passage the learner first READS (per-sentence
// narration + L1 gloss) and then RECITES through a progressive cloze ladder.
//
// Where each half lives (see ssot-schemas/db-schemas/stemrobin.sql for the contract):
//   * the ENGLISH sentence is the artifact being learned, identical in every locale →
//     neutral base (sr_lessons.content), never duplicated per locale;
//   * the L1 GLOSS (中文, later others) is per-locale prose → sr_lesson_i18n overlay,
//     keyed by the sentence node id.
//
// Answer-key secrecy (charter engineering-rules · G5): the recitation answer IS the
// sentence text, so there is no separate KEY to strip. Secrecy is enforced by
// PROJECTION instead — `projectReading` may carry `text` (the read phase deliberately
// shows it), but `projectRecitation` emits masked tokens that carry NO text for any
// hidden word, and grading happens only in `judgeSentence` on the server.

// ── Neutral JSONB shape ──
// v2 (STEMROBIN-87): the blueprint makes sentence PATTERNS the core of the course —
// 2–4 templates per lesson with a `___` slot the learner swaps words into. That is
// the same shape as the cloze ladder, so patterns are data, not prose: the ladder
// blanks slot words first, which is exactly "memorize the template, then speak".
export type Pattern = {
  id: string
  template: string // "Look ___ and ___ before you cross."
  zh?: string | null // filled from the per-locale overlay
}
export type ShortTextSentence = {
  id: string
  num: number
  text: string
  speaker?: string | null // dialogue turns; null for narration
  pattern?: string | null // id of the pattern this sentence realizes
  slots?: number[] // word-token indices that fill this pattern's `___` slots
  targets: number[] // 0-based word-token indices of this lesson's new VOA target words
  rev?: number
}
// The lesson's VOA1500 words (its newly-introduced target words), with the Chinese
// meaning, shown as a 中英对照 word list after the passage. `key` is the VOA headword
// entry-key ("hungry" -> "hunger"), used to match the same word across lessons for
// the new-vs-review split.
export type VocabItem = { en: string; pos: string; zh: string; key: string }
export type ShortTextContent = {
  kind: 'short-text'
  v?: number
  theme?: string
  scene?: string // the blueprint's 场景
  form?: 'dialogue' | 'narrative'
  patterns?: Pattern[]
  properNames?: string[] // author-declared names allowed outside the VOA1500 list
  vocab?: VocabItem[]
  coveredKeys?: string[] // VOA entry-keys the passage covers (for review detection)
  sentences: ShortTextSentence[]
}
type Overlay = Record<string, { t: string; src_rev: number }>

export function isShortText(content: unknown): content is ShortTextContent {
  return (
    !!content &&
    typeof content === 'object' &&
    (content as ShortTextContent).kind === 'short-text' &&
    Array.isArray((content as ShortTextContent).sentences)
  )
}

// ── Tokenization ──
// Words are the maskable units; everything else (spaces, punctuation) is structure
// that stays visible so the learner still sees sentence shape at every ladder level.
export type Token = { w: string; isWord: boolean }

export function tokenize(text: string): Token[] {
  const out: Token[] = []
  const re = /[A-Za-z][A-Za-z'’-]*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ w: text.slice(last, m.index), isWord: false })
    out.push({ w: m[0], isWord: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ w: text.slice(last), isWord: false })
  return out
}

export function wordIndices(tokens: Token[]): number[] {
  const idx: number[] = []
  tokens.forEach((t, i) => { if (t.isWord) idx.push(i) })
  return idx
}

// ── The ladder ──
// Level 1..5 hide ~20/40/60/80/100% of the words. Nesting (level n hides everything
// level n-1 hid, plus more) is guaranteed BY CONSTRUCTION: every level takes a prefix
// of ONE fixed priority order, so a longer prefix is always a superset.
//
// Priority (v2, STEMROBIN-89): **pattern slot words first**, then this lesson's target
// words, then the rest longest-first. The slot is the `___` of the lesson's pattern, so
// level 1 leaves the template's fixed frame visible and blanks exactly the swappable
// part — "背下来就能换词照说". Targets come next (words worth recalling), and the
// longest-first tail is a deterministic proxy that pushes content words ahead of short
// function words, so glue disappears only at the later levels. No randomness, so a
// level is reproducible without storing anything.
export const LADDER_RATIOS = [0.2, 0.4, 0.6, 0.8, 1] as const
export type Level = 1 | 2 | 3 | 4 | 5

export function maskPriority(tokens: Token[], targets: number[], slots: number[] = []): number[] {
  const words = wordIndices(tokens)
  const toTokenIdx = (ns: number[]) => new Set(ns.map((n) => words[n]).filter((i) => i !== undefined))
  const slotSet = toTokenIdx(slots)
  const targetSet = toTokenIdx(targets)
  const slotted = words.filter((i) => slotSet.has(i))
  const targeted = words.filter((i) => !slotSet.has(i) && targetSet.has(i))
  const rest = words
    .filter((i) => !slotSet.has(i) && !targetSet.has(i))
    .sort((a, b) => tokens[b].w.length - tokens[a].w.length || a - b)
  return [...slotted, ...targeted, ...rest]
}

export function hiddenIndices(
  tokens: Token[],
  targets: number[],
  level: Level,
  slots: number[] = [],
): Set<number> {
  const order = maskPriority(tokens, targets, slots)
  const n = Math.ceil(LADDER_RATIOS[level - 1] * order.length)
  return new Set(order.slice(0, n))
}

// ── Browser-facing shapes ──
export type ReadingSentence = { id: string; num: number; text: string; gloss: string | null; hasAudio: boolean; speaker: string | null; pattern: string | null }
// A hidden slot carries NO `w` — the answer never reaches the browser.
export type MaskedToken = { w: string; isWord: boolean } | { hidden: true; isWord: true }
export type RecitationSentence = { id: string; num: number; tokens: MaskedToken[]; blanks: number; speaker: string | null }

// Read phase: full text + this locale's gloss + whether narration exists.
export function projectReading(
  content: ShortTextContent,
  overlay: Overlay,
  audioNodes: Set<string>,
): ReadingSentence[] {
  return content.sentences.map((s) => ({
    id: s.id,
    num: s.num,
    text: s.text,
    gloss: overlay[s.id]?.t ?? null,
    hasAudio: audioNodes.has(s.id),
    speaker: s.speaker ?? null,
    pattern: s.pattern ?? null,
  }))
}

// Recite phase: masked tokens only. Hidden words are replaced by a slot with no text,
// so the recitation payload cannot be read off the wire.
export function projectRecitation(content: ShortTextContent, level: Level): RecitationSentence[] {
  return content.sentences.map((s) => {
    const tokens = tokenize(s.text)
    const hide = hiddenIndices(tokens, s.targets, level, s.slots ?? [])
    let blanks = 0
    const masked: MaskedToken[] = tokens.map((t, i) => {
      if (t.isWord && hide.has(i)) { blanks++; return { hidden: true, isWord: true } }
      return { w: t.w, isWord: t.isWord }
    })
    return { id: s.id, num: s.num, tokens: masked, blanks, speaker: s.speaker ?? null }
  })
}

// ── Server-side judging ──
// Per the spec, spelling and word ORDER are strict, but case and punctuation are NOT
// a failure cause — recitation practice must not degrade into a punctuation exam.
export function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z']/g, '')
}

// Judge the blanks of one sentence at one level. `answers` are the learner's words for
// the hidden slots, in order. Returns which slots are wrong — the caller shows only the
// POSITIONS first, never the expected word.
export function judgeSentence(
  sentence: ShortTextSentence,
  level: Level,
  answers: string[],
): { isCorrect: boolean; wrong: number[] } {
  const tokens = tokenize(sentence.text)
  const hide = hiddenIndices(tokens, sentence.targets, level, sentence.slots ?? [])
  const expected = tokens.map((t, i) => (t.isWord && hide.has(i) ? t.w : null)).filter((w): w is string => w !== null)
  const wrong: number[] = []
  expected.forEach((exp, i) => {
    if (normalizeWord(answers[i] ?? '') !== normalizeWord(exp)) wrong.push(i)
  })
  return { isCorrect: wrong.length === 0, wrong }
}

// Level 5 (全文默写): the learner writes the sentence continuously, so compare the
// whole normalized word sequence — strict on words/spelling/order, blind to case and
// punctuation. Length mismatches surface as wrong positions too.
export function judgeFreeText(expectedText: string, submitted: string): { isCorrect: boolean; wrong: number[] } {
  const exp = tokenize(expectedText).filter((t) => t.isWord).map((t) => normalizeWord(t.w))
  const got = tokenize(submitted).filter((t) => t.isWord).map((t) => normalizeWord(t.w))
  const wrong: number[] = []
  for (let i = 0; i < Math.max(exp.length, got.length); i++) {
    if (exp[i] !== got[i]) wrong.push(i)
  }
  return { isCorrect: wrong.length === 0, wrong }
}

// ── Fetchers ──
// Reserved node id under which the whole-passage narration is stored in
// sr_lesson_audio, alongside the per-sentence clips.
export const FULL_AUDIO_NODE = 'full'

type Row = { title: string; content: unknown; overlay: unknown }
export type EnglishVocab = { en: string; zh: string }

export const getEnglishReading = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<{
    seq: number
    title: string
    theme: string | null
    form: 'dialogue' | 'narrative'
    patterns: Pattern[]
    hasFullAudio: boolean
    newWords: EnglishVocab[]
    reviewWords: EnglishVocab[]
    sentences: ReadingSentence[]
  } | null> => {
    const locale = currentLocale()
    const rows = (await sql()`
      select l.title, l.content, i.overlay
      from sr_lessons l
      left join sr_lesson_i18n i on i.lesson_id = l.id and i.locale = ${locale}
      where l.id = ${id} and l.subject = 'english'
    `) as unknown as Row[]
    if (!rows.length || !isShortText(rows[0].content)) return null
    const content = rows[0].content
    const overlay = (rows[0].overlay as Overlay | null) ?? {}
    const audio = (await sql()`
      select node_id from sr_lesson_audio where lesson_id = ${id}
    `) as unknown as { node_id: string }[]

    // Sequence + cross-lesson vocab: which words this passage reuses from earlier
    // lessons (review) vs first introduces (new). A word is "introduced" by the
    // earliest lesson (by stage/order) whose vocab lists it; earlier target words
    // that reappear in this passage (by covered entry-key) are review words.
    const all = (await sql()`
      select id, content->'vocab' as vocab
      from sr_lessons where subject = 'english'
      order by stage, lesson_order
    `) as unknown as { id: string; vocab: VocabItem[] | null }[]
    const seq = Math.max(1, all.findIndex((r) => r.id === id) + 1)
    const introduced = new Map<string, EnglishVocab>() // key -> word, from its introducing lesson
    for (const l of all) {
      if (l.id === id) break // only lessons BEFORE this one
      for (const v of l.vocab ?? []) if (v.key && !introduced.has(v.key)) introduced.set(v.key, { en: v.en, zh: v.zh })
    }
    const newWords: EnglishVocab[] = (content.vocab ?? []).map((v) => ({ en: v.en, zh: v.zh }))
    const newKeys = new Set((content.vocab ?? []).map((v) => v.key))
    const reviewWords: EnglishVocab[] = (content.coveredKeys ?? [])
      .filter((k) => !newKeys.has(k) && introduced.has(k))
      .map((k) => introduced.get(k)!)

    // Pattern templates are neutral; their 中文 lives in the same per-locale overlay
    // as the sentence gloss, keyed by pattern id.
    const patterns: Pattern[] = (content.patterns ?? []).map((p) => ({
      id: p.id,
      template: p.template,
      zh: overlay[p.id]?.t ?? null,
    }))
    const audioNodes = new Set(audio.map((a) => a.node_id))

    return {
      seq,
      title: rows[0].title,
      theme: content.theme ?? null,
      form: content.form ?? 'narrative',
      patterns,
      hasFullAudio: audioNodes.has(FULL_AUDIO_NODE),
      newWords,
      reviewWords,
      sentences: projectReading(content, overlay, audioNodes),
    }
  })

// Catalog for the 短文学英语 column. Unlike math/physics — whose outline is a static
// list in curriculum.ts with DB-driven availability — the short-text titles are
// generated, so the English catalog IS the DB. Lessons are numbered by a flat global
// sequence (1, 2, 3 …) across the whole course, not grouped into units.
export type EnglishLessonRef = { id: string; seq: number; title: string }

export const listEnglishLessons = createServerFn({ method: 'GET' }).handler(
  async (): Promise<EnglishLessonRef[]> => {
    const rows = (await sql()`
      select id, title
      from sr_lessons where subject = 'english'
      order by stage, lesson_order
    `) as unknown as { id: string; title: string }[]
    return rows.map((r, i) => ({ id: r.id, seq: i + 1, title: r.title }))
  },
)

// One sentence's narration, base64 — same shape as getLessonPdf (bytes stay
// server-side, the client builds a Blob). Fetched on click so the page load does
// not carry ~450KB of audio it may never play.
export const getSentenceAudio = createServerFn({ method: 'GET' })
  .validator((d: { lessonId: string; nodeId: string }) => d)
  .handler(async ({ data }): Promise<{ mime: string; b64: string } | null> => {
    const rows = (await sql()`
      select mime, bytes from sr_lesson_audio
      where lesson_id = ${data.lessonId} and node_id = ${data.nodeId}
    `) as unknown as { mime: string; bytes: Buffer }[]
    if (!rows.length) return null
    return { mime: rows[0].mime, b64: Buffer.from(rows[0].bytes).toString('base64') }
  })

// One VOA word's pronunciation, base64. Course-global: "walk" is synthesized once and
// reused by every lesson that teaches or reviews it (sr_word_audio is keyed by word,
// not by lesson).
export const getWordAudio = createServerFn({ method: 'GET' })
  .validator((w: string) => w)
  .handler(async ({ data: word }): Promise<{ mime: string; b64: string } | null> => {
    const rows = (await sql()`
      select mime, bytes from sr_word_audio where word = ${word.toLowerCase()}
    `) as unknown as { mime: string; bytes: Buffer }[]
    if (!rows.length) return null
    return { mime: rows[0].mime, b64: Buffer.from(rows[0].bytes).toString('base64') }
  })

// The recitation payload: masked tokens only. Deliberately does NOT return `text`.
export const getRecitation = createServerFn({ method: 'GET' })
  .validator((d: { lessonId: string; level: Level }) => d)
  .handler(async ({ data }): Promise<RecitationSentence[] | null> => {
    const rows = (await sql()`
      select content from sr_lessons where id = ${data.lessonId} and subject = 'english'
    `) as unknown as { content: unknown }[]
    if (!rows.length || !isShortText(rows[0].content)) return null
    return projectRecitation(rows[0].content, data.level)
  })
