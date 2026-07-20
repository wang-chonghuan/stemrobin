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
export type ShortTextSentence = {
  id: string
  num: number
  text: string
  targets: number[] // 0-based word-token indices of this lesson's new VOA target words
  rev?: number
}
export type ShortTextContent = {
  kind: 'short-text'
  theme?: string
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
// Priority: this lesson's target words first (level 1 = "目标词和关键动词"), then the
// remaining words longest-first — a deterministic proxy that pushes content words
// ahead of short function words, so prepositions/glue disappear at the later levels
// exactly as the ladder intends. No randomness, so a level is reproducible without
// storing anything.
export const LADDER_RATIOS = [0.2, 0.4, 0.6, 0.8, 1] as const
export type Level = 1 | 2 | 3 | 4 | 5

export function maskPriority(tokens: Token[], targets: number[]): number[] {
  const words = wordIndices(tokens)
  const targetSet = new Set(targets.map((n) => words[n]).filter((i) => i !== undefined))
  const isTarget = (i: number) => targetSet.has(i)
  const targeted = words.filter(isTarget)
  const rest = words
    .filter((i) => !isTarget(i))
    .sort((a, b) => tokens[b].w.length - tokens[a].w.length || a - b)
  return [...targeted, ...rest]
}

export function hiddenIndices(tokens: Token[], targets: number[], level: Level): Set<number> {
  const order = maskPriority(tokens, targets)
  const n = Math.ceil(LADDER_RATIOS[level - 1] * order.length)
  return new Set(order.slice(0, n))
}

// ── Browser-facing shapes ──
export type ReadingSentence = { id: string; num: number; text: string; gloss: string | null; hasAudio: boolean }
// A hidden slot carries NO `w` — the answer never reaches the browser.
export type MaskedToken = { w: string; isWord: boolean } | { hidden: true; isWord: true }
export type RecitationSentence = { id: string; num: number; tokens: MaskedToken[]; blanks: number }

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
  }))
}

// Recite phase: masked tokens only. Hidden words are replaced by a slot with no text,
// so the recitation payload cannot be read off the wire.
export function projectRecitation(content: ShortTextContent, level: Level): RecitationSentence[] {
  return content.sentences.map((s) => {
    const tokens = tokenize(s.text)
    const hide = hiddenIndices(tokens, s.targets, level)
    let blanks = 0
    const masked: MaskedToken[] = tokens.map((t, i) => {
      if (t.isWord && hide.has(i)) { blanks++; return { hidden: true, isWord: true } }
      return { w: t.w, isWord: t.isWord }
    })
    return { id: s.id, num: s.num, tokens: masked, blanks }
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
  const hide = hiddenIndices(tokens, sentence.targets, level)
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
type Row = { content: unknown; overlay: unknown }

export const getEnglishReading = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<{ theme: string | null; sentences: ReadingSentence[] } | null> => {
    const locale = currentLocale()
    const rows = (await sql()`
      select l.content, i.overlay
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
    return {
      theme: content.theme ?? null,
      sentences: projectReading(content, overlay, new Set(audio.map((a) => a.node_id))),
    }
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
