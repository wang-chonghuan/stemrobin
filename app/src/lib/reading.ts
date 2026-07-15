import { createServerFn } from '@tanstack/react-start'
import { sql } from '~/lib/db'
import { currentUserId } from '~/lib/session.server'
import { normalizeMathAnswer } from '~/lib/answer-normalize'

// Card-by-card 精读 (close-reading) data for a migrated math lesson. The 課文 is
// the JSONB SSOT in sr_lessons.content (a neutral, ordered, numbered card tree,
// each card carrying its own read-check); learner-facing prose lives in the
// per-locale sr_lesson_i18n overlay keyed by node id. This module projects that
// pair into a browser-facing reading payload and judges read-checks server-side.
//
// Answer-key secrecy (charter engineering-rules · G5): the read-check KEY
// (correct_index / accept) lives ONLY in the neutral content JSONB. It is
// structurally projected out here and is NEVER placed in the fetch payload —
// correctness is returned only by recordReadCheck after the learner answers.
//
// This ticket is zh-only (STEMROBIN-22); `locale` is a parameter defaulted to
// 'zh' so STEMROBIN-24 (language switching) can generalize without reshaping this.
const SOURCE_LOCALE = 'zh'

// ── Neutral JSONB shapes (subset this module reads; see ssot-schemas stemrobin.sql) ──
type ProseNode = { id: string; kind: 'prose'; role: string }
type SvgNode = { kind: 'svg'; svg: string; caption_id?: string }
type BodyNode = ProseNode | SvgNode
type NeutralReadCheck = {
  id: string
  mode: 'choice' | 'input'
  key: { correct_index?: number; accept?: string[] }
  options?: string[] // node-id refs (choice only)
}
type NeutralCard = {
  id: string
  num: number
  anchor: string
  body: BodyNode[]
  read_check?: NeutralReadCheck[]
}
type Content = { cards: NeutralCard[] }
type Overlay = Record<string, { t: string; src_rev: number }>

// ── Browser-facing shapes (KEY-free) ──
export type ReadCheck = {
  id: string
  mode: 'choice' | 'input'
  prompt: string
  options: string[] | null // resolved option text (choice); null for input
}
export type ReadingCard = {
  id: string
  num: number
  anchor: string
  bodyHtml: string
  readChecks: ReadCheck[]
}
// `head` is the lesson's own <head> inner HTML (KaTeX + DESIGN tokens + the
// generated stylesheet), reused as the per-card iframe head so formulas and the
// lesson's element classes (sr-fig / sr-term / sr-example / …) render identically.
export type LessonReading = { head: string; cards: ReadingCard[] } | null

// Resolve one prose node id to its overlay HTML. Fails fast on a missing node
// rather than silently emitting empty content (SSOT hole must surface, not hide).
function proseText(overlay: Overlay, nodeId: string): string {
  const entry = overlay[nodeId]
  if (!entry) throw new Error(`reading: overlay missing node ${nodeId}`)
  return entry.t
}

// Assemble a card's body HTML from its ordered neutral nodes: prose → overlay
// text; svg → the neutral inline svg wrapped as the lesson does (figure.sr-fig +
// figcaption from the caption node). Formulas stay as $…$ for KaTeX in the iframe.
function bodyToHtml(card: NeutralCard, overlay: Overlay): string {
  const parts: string[] = []
  for (const node of card.body) {
    if (node.kind === 'prose') {
      parts.push(proseText(overlay, node.id))
    } else if (node.kind === 'svg') {
      const caption = node.caption_id
        ? `<figcaption>${proseText(overlay, node.caption_id)}</figcaption>`
        : ''
      parts.push(`<figure class="sr-fig">${node.svg}${caption}</figure>`)
    }
  }
  return parts.join('\n')
}

// Project one neutral read-check into its KEY-free browser shape. The `key` is
// never read into the output; choice options are resolved to overlay text.
function projectReadCheck(rc: NeutralReadCheck, overlay: Overlay): ReadCheck {
  return {
    id: rc.id,
    mode: rc.mode,
    prompt: proseText(overlay, rc.id),
    options:
      rc.mode === 'choice'
        ? (rc.options ?? []).map((optId) => proseText(overlay, optId))
        : null,
  }
}

// Pure projection (DB-free, unit-tested): neutral content + locale overlay →
// ordered KEY-free reading cards. Order follows content.cards[] array position.
export function projectCards(content: Content, overlay: Overlay): ReadingCard[] {
  return content.cards.map((card) => ({
    id: card.id,
    num: card.num,
    anchor: card.anchor,
    bodyHtml: bodyToHtml(card, overlay),
    readChecks: (card.read_check ?? []).map((rc) => projectReadCheck(rc, overlay)),
  }))
}

// Pure server-side judge (DB-free, unit-tested). choice: chosen === correct_index;
// input: normalized text matches any accepted form (same normalizer as the
// practice deck, so authors enumerate only genuinely different forms).
export function judgeReadCheck(
  rc: NeutralReadCheck,
  submission: { chosen?: number; text?: string },
): boolean {
  if (rc.mode === 'choice') {
    return (
      typeof submission.chosen === 'number' &&
      submission.chosen === rc.key.correct_index
    )
  }
  // input
  if (typeof submission.text !== 'string' || !submission.text.trim()) return false
  const typed = normalizeMathAnswer(submission.text)
  return (rc.key.accept ?? []).some((a) => normalizeMathAnswer(a) === typed)
}

// Extract the inner HTML of the lesson's own <head> from its derived html cache.
function extractHead(html: string | null): string {
  if (!html) return ''
  const m = html.match(/<head>([\s\S]*?)<\/head>/i)
  return m ? m[1] : ''
}

// GET the reading payload for a lesson: the lesson's <head> styling shell + the
// ordered KEY-free cards. Returns null when the lesson has no JSONB content
// (caller falls back to the full-html view). DB access stays server-side.
export const getLessonReading = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<LessonReading> => {
    const rows = await sql()`
      select l.content, l.html, i.overlay
      from sr_lessons l
      left join sr_lesson_i18n i
        on i.lesson_id = l.id and i.locale = ${SOURCE_LOCALE}
      where l.id = ${id}
    `
    if (!rows.length) return null
    const content = rows[0].content as Content | null
    const overlay = (rows[0].overlay as Overlay | null) ?? {}
    if (!content || !Array.isArray(content.cards) || content.cards.length === 0) {
      return null // no card tree → route falls back to full html
    }
    return { head: extractHead(rows[0].html), cards: projectCards(content, overlay) }
  })

export type ReadCheckResult = { isCorrect: boolean } | { error: string }

// POST one read-check answer. Judged server-side against the hidden KEY in the
// content JSONB (never sent to the client). Recorded in sr_content_answer_events
// only when a learner is logged in (未登录不记录作答); a logged-out learner is
// still judged so the reading flow stays usable. Soft gate — no penalty stored.
export const recordReadCheck = createServerFn({ method: 'POST' })
  .validator((d: { lessonId: string; nodeId: string; chosen?: number; text?: string }) => d)
  .handler(async ({ data }): Promise<ReadCheckResult> => {
    const rows = await sql()`select content from sr_lessons where id = ${data.lessonId}`
    if (!rows.length || !rows[0].content) return { error: '课程内容不存在' }
    const content = rows[0].content as Content
    let target: NeutralReadCheck | undefined
    for (const card of content.cards) {
      target = (card.read_check ?? []).find((rc) => rc.id === data.nodeId)
      if (target) break
    }
    if (!target) return { error: '题目不存在' }
    if (target.mode === 'choice' && typeof data.chosen !== 'number') {
      return { error: '缺少选项' }
    }
    if (target.mode === 'input' && (typeof data.text !== 'string' || !data.text.trim())) {
      return { error: '请先输入答案' }
    }

    const isCorrect = judgeReadCheck(target, { chosen: data.chosen, text: data.text })

    // Record only when logged in; the read is not itself login-gated.
    const uid = currentUserId()
    if (uid != null) {
      await sql()`
        insert into sr_content_answer_events
          (user_id, lesson_id, kind, node_id, is_correct, chosen, answer_text, locale)
        values (
          ${uid}, ${data.lessonId}, 'read_check', ${data.nodeId}, ${isCorrect},
          ${target.mode === 'choice' ? (data.chosen ?? null) : null},
          ${target.mode === 'input' ? (data.text?.trim() ?? null) : null},
          ${SOURCE_LOCALE}
        )
      `
    }
    return { isCorrect }
  })
