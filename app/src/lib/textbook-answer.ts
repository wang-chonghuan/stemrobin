import { createServerFn } from '@tanstack/react-start'
import type { ComputeEngine } from '@cortex-js/compute-engine'

import { normalizeMathAnswer } from '~/lib/answer-normalize'
import { sql } from '~/lib/db'
import { currentLocale } from '~/lib/locale.server'
import { currentUserId } from '~/lib/session.server'

type AnswerPart = {
  label?: string
  judge: 'exact' | 'numeric' | 'expression'
  expected: string[]
  unit?: string
  tolerance?: number
}

type AnswerKey = {
  grading: 'auto' | 'ungraded'
  displayAnswer: string
  parts: AnswerPart[]
}

let enginePromise: Promise<ComputeEngine> | null = null

function mathEngine(): Promise<ComputeEngine> {
  enginePromise ??= import('@cortex-js/compute-engine').then(
    ({ ComputeEngine }) => new ComputeEngine(),
  )
  return enginePromise
}

export type TextbookAnswerResult =
  | {
      verdict: 'correct' | 'incorrect'
      displayAnswer: string
      parts: { label?: string; isCorrect: boolean }[]
    }
  | { verdict: 'ungraded'; displayAnswer: string; parts: [] }
  | { error: string }

function cleanNumericLatex(value: string, unit?: string): string {
  let cleaned = value
    .trim()
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/,/g, '')
  if (unit === '%') cleaned = cleaned.replace(/\\%|%/g, '')
  if (unit === '°') {
    cleaned = cleaned
      .replace(/\^\{?\\circ\}?/g, '')
      .replace(/\\degree|°/g, '')
  }
  if (unit) {
    cleaned = cleaned
      .replace(/\\(?:text|mathrm|operatorname)\{[^{}]*\}/g, '')
      .replace(/[a-zA-Z\u4e00-\u9fff/]+$/g, '')
  }
  return cleaned.trim()
}

export async function judgeTextbookPart(part: AnswerPart, submitted: string): Promise<boolean> {
  if (part.judge === 'exact') {
    const normalized = normalizeMathAnswer(submitted)
    return part.expected.some((expected) => normalizeMathAnswer(expected) === normalized)
  }

  const engine = await mathEngine()
  const input = engine.parse(
    part.judge === 'numeric' ? cleanNumericLatex(submitted, part.unit) : submitted,
  )
  if (!input || input.has('Error')) return false

  return part.expected.some((expected) => {
    const target = engine.parse(
      part.judge === 'numeric' ? cleanNumericLatex(expected, part.unit) : expected,
    )
    if (!target || target.has('Error')) return false
    if (part.judge === 'numeric' && (part.tolerance ?? 0) > 0) {
      const left = input.N()
      const right = target.N()
      return (
        Number.isFinite(left.re) &&
        Number.isFinite(right.re) &&
        left.im === 0 &&
        right.im === 0 &&
        Math.abs(left.re - right.re) <= (part.tolerance ?? 0)
      )
    }
    return input.isEqual(target) === true
  })
}

export const checkTextbookAnswer = createServerFn({ method: 'POST' })
  .validator((data: { lessonId: string; exercise: string; answers: string[] }) => data)
  .handler(async ({ data }): Promise<TextbookAnswerResult> => {
    if (
      !data.lessonId ||
      !data.exercise ||
      !Array.isArray(data.answers) ||
      data.answers.length > 32 ||
      data.answers.some((answer) => typeof answer !== 'string' || answer.length > 2000)
    ) {
      return { error: '作答数据无效' }
    }

    const rows = await sql()`select exercises from sr_lessons where id = ${data.lessonId}`
    if (!rows.length) return { error: '课程不存在' }
    const deck = rows[0].exercises as
      | { exercises?: { number: string | number; answerKey?: AnswerKey }[] }
      | null
    const exercise = deck?.exercises?.find(
      (item) => String(item.number) === String(data.exercise),
    )
    const key = exercise?.answerKey
    if (!key || !key.displayAnswer) return { error: '该题还没有标准答案' }

    if (key.grading === 'auto') {
      if (
        !Array.isArray(key.parts) ||
        key.parts.length === 0 ||
        data.answers.length !== key.parts.length ||
        data.answers.some((answer) => !answer.trim())
      ) {
        return { error: '请完成全部小题' }
      }
      const judged = await Promise.all(
        key.parts.map((part, index) => judgeTextbookPart(part, data.answers[index])),
      )
      const isCorrect = judged.every(Boolean)
      const uid = currentUserId()
      if (uid != null) {
        await sql()`
          insert into sr_content_answer_events
            (user_id, lesson_id, kind, node_id, is_correct, answer_text, locale)
          values (
            ${uid}, ${data.lessonId}, 'exercise', ${String(data.exercise)}, ${isCorrect},
            ${data.answers.map((answer) => answer.trim()).join('\n')}, ${currentLocale()}
          )
        `
      }
      return {
        verdict: isCorrect ? 'correct' : 'incorrect',
        displayAnswer: key.displayAnswer,
        parts: key.parts.map((part, index) => ({
          ...(part.label ? { label: part.label } : {}),
          isCorrect: judged[index],
        })),
      }
    }

    if (key.grading === 'ungraded') {
      const uid = currentUserId()
      if (uid != null) {
        await sql()`
          insert into sr_content_answer_events
            (user_id, lesson_id, kind, node_id, is_correct, answer_text, locale)
          values (
            ${uid}, ${data.lessonId}, 'exercise', ${String(data.exercise)}, ${null},
            ${data.answers.map((answer) => answer.trim()).join('\n') || null},
            ${currentLocale()}
          )
        `
      }
      return { verdict: 'ungraded', displayAnswer: key.displayAnswer, parts: [] }
    }

    return { error: '该题答案配置无效' }
  })
