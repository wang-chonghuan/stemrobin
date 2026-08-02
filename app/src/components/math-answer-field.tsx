import { Check, CheckCircle2, Eye, Info, LoaderCircle, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { t, type Locale } from '~/lib/i18n'
import type { ExerciseAnswerSpec } from '~/lib/lessons'
import {
  checkTextbookAnswer,
  type TextbookAnswerResult,
} from '~/lib/textbook-answer'

type KeyboardMode = 'basic' | 'more'
type MathField = HTMLElement & {
  value: string
  placeholder: string
  readOnly: boolean
  smartFence: boolean
  mathVirtualKeyboardPolicy: 'auto' | 'manual' | 'sandboxed'
}
type MathKeyboard = {
  layouts: string
  show: (options?: { animate: boolean }) => void
  hide: (options?: { animate: boolean }) => void
}

let sharedKeyboard: MathKeyboard | undefined

function keyboard(): MathKeyboard | undefined {
  return (
    sharedKeyboard ??
    (window as unknown as { mathVirtualKeyboard?: MathKeyboard }).mathVirtualKeyboard
  )
}

function setKeyboardMode(mode: KeyboardMode) {
  const mathKeyboard = keyboard()
  if (mathKeyboard) mathKeyboard.layouts = mode === 'basic' ? 'compact' : 'default'
}

function revealField(field: MathField | null) {
  window.setTimeout(() => field?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 180)
}

function MathInput({
  index,
  storageKey,
  locale,
  locked,
  label,
  onValue,
}: {
  index: number
  storageKey: string
  locale: Locale
  locked: boolean
  label: ReactNode
  onValue: (index: number, value: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<MathField | null>(null)
  const modeRef = useRef<KeyboardMode>('more')
  const [mode, setMode] = useState<KeyboardMode>('more')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let field: MathField | null = null
    let onInput: (() => void) | null = null
    let onFocus: (() => void) | null = null

    void import('mathlive').then(({
      MathfieldElement,
      initVirtualKeyboardInCurrentBrowsingContext,
    }) => {
      if (disposed) return
      sharedKeyboard ??=
        initVirtualKeyboardInCurrentBrowsingContext() as unknown as MathKeyboard
      MathfieldElement.fontsDirectory = null
      MathfieldElement.soundsDirectory = null
      MathfieldElement.keypressSound = null
      MathfieldElement.plonkSound = null

      field = new MathfieldElement() as MathField
      field.className = 'sr-math-field'
      field.smartFence = true
      field.readOnly = locked
      field.mathVirtualKeyboardPolicy = 'manual'
      field.placeholder =
        locale === 'zh' ? '\\text{填写答案}' : '\\text{Enter your answer}'
      field.setAttribute('aria-label', t(locale, 'exercise.answer'))
      field.value = localStorage.getItem(storageKey) ?? ''
      onValue(index, field.value)

      onInput = () => {
        const value = field?.value ?? ''
        localStorage.setItem(storageKey, value)
        onValue(index, value)
      }
      onFocus = () => {
        setKeyboardMode(modeRef.current)
        keyboard()?.show({ animate: true })
        revealField(field)
      }
      field.addEventListener('input', onInput)
      field.addEventListener('focusin', onFocus)
      fieldRef.current = field
      host.replaceChildren(field)
    })

    return () => {
      disposed = true
      if (field && onInput) field.removeEventListener('input', onInput)
      if (field && onFocus) field.removeEventListener('focusin', onFocus)
      fieldRef.current = null
      host.replaceChildren()
      keyboard()?.hide({ animate: false })
    }
  }, [index, locale, onValue, storageKey])

  useEffect(() => {
    if (fieldRef.current) fieldRef.current.readOnly = locked
  }, [locked])

  function activateMode(next: KeyboardMode) {
    if (locked) return
    modeRef.current = next
    setMode(next)
    setKeyboardMode(next)
    fieldRef.current?.focus()
    keyboard()?.show({ animate: true })
    revealField(fieldRef.current)
  }

  return (
    <div className="sr-math-part">
      <div className="sr-math-answer-head">
        <span className="sr-math-answer-label">{label}</span>
        <div className="sr-math-modes" role="group" aria-label={t(locale, 'exercise.keyboard')}>
          <button
            type="button"
            className={mode === 'basic' ? 'on' : ''}
            aria-pressed={mode === 'basic'}
            disabled={locked}
            onClick={() => activateMode('basic')}
          >
            {t(locale, 'exercise.keyboard.basic')}
          </button>
          <button
            type="button"
            className={mode === 'more' ? 'on' : ''}
            aria-pressed={mode === 'more'}
            disabled={locked}
            onClick={() => activateMode('more')}
          >
            {t(locale, 'exercise.keyboard.more')}
          </button>
        </div>
      </div>
      <div className="sr-math-field-host" ref={hostRef} />
    </div>
  )
}

export function MathAnswerField({
  lessonId,
  exercise,
  storageKey,
  locale,
  answerSpec,
}: {
  lessonId: string
  exercise: string
  storageKey: string
  locale: Locale
  answerSpec?: ExerciseAnswerSpec
}) {
  const fieldCount = answerSpec?.grading === 'auto' ? answerSpec.parts.length : 1
  const [values, setValues] = useState<string[]>(() => Array(fieldCount).fill(''))
  const [result, setResult] = useState<TextbookAnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValues(Array(fieldCount).fill(''))
    setResult(null)
    setError('')
  }, [exercise, fieldCount, lessonId])

  const onValue = useCallback((index: number, value: string) => {
    setValues((current) => {
      const next = [...current]
      next[index] = value
      return next
    })
  }, [])

  async function submit() {
    if (!answerSpec || submitting || (result && !('error' in result))) return
    if (answerSpec.grading === 'auto' && values.some((value) => !value.trim())) {
      setError(t(locale, 'exercise.completeAll'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await checkTextbookAnswer({
        data: { lessonId, exercise, answers: values },
      })
      if ('error' in response) {
        setError(response.error)
      } else {
        setResult(response)
        keyboard()?.hide({ animate: true })
      }
    } catch {
      setError(t(locale, 'err.network'))
    } finally {
      setSubmitting(false)
    }
  }

  const completed = result != null && !('error' in result)

  if (!answerSpec) {
    return (
      <div className="sr-math-answer sr-math-unavailable">
        <Info size={16} aria-hidden />
        <span>{t(locale, 'exercise.unavailable')}</span>
      </div>
    )
  }

  return (
    <div className="sr-math-answer">
      {Array.from({ length: fieldCount }, (_, index) => {
        const part = answerSpec?.parts[index]
        return (
          <MathInput
            key={index}
            index={index}
            storageKey={`${storageKey}:${index}`}
            locale={locale}
            locked={completed}
            onValue={onValue}
            label={
              <>
                {part?.label
                  ? `${part.label} ${t(locale, 'exercise.answer')}`
                  : t(locale, 'exercise.answer')}
                {part?.unit && <span className="sr-math-unit"> · {part.unit}</span>}
              </>
            }
          />
        )
      })}

      {answerSpec && !completed && (
        <div className="sr-math-actions">
          <button
            type="button"
            className="sr-math-submit"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? (
              <LoaderCircle size={15} className="sr-spin" aria-hidden />
            ) : answerSpec.grading === 'ungraded' ? (
              <Eye size={15} aria-hidden />
            ) : (
              <Check size={15} aria-hidden />
            )}
            {submitting
              ? t(locale, 'exercise.submitting')
              : answerSpec.grading === 'ungraded'
                ? t(locale, 'exercise.reveal')
                : t(locale, 'exercise.submit')}
          </button>
        </div>
      )}

      {error && <p className="sr-math-error">{error}</p>}

      {completed && (
        <div className={`sr-math-result ${result.verdict}`}>
          <div className="sr-math-verdict">
            {result.verdict === 'correct' ? (
              <CheckCircle2 size={18} aria-hidden />
            ) : result.verdict === 'incorrect' ? (
              <XCircle size={18} aria-hidden />
            ) : (
              <Info size={18} aria-hidden />
            )}
            <strong>
              {result.verdict === 'correct'
                ? t(locale, 'exercise.correct')
                : result.verdict === 'incorrect'
                  ? t(locale, 'exercise.incorrect')
                  : t(locale, 'exercise.ungraded')}
            </strong>
          </div>
          {result.parts.length > 1 && (
            <p className="sr-math-part-results">
              {result.parts
                .map(
                  (part, index) =>
                    `${part.label ?? `${index + 1})`} ${
                      part.isCorrect
                        ? t(locale, 'exercise.part.correct')
                        : t(locale, 'exercise.part.incorrect')
                    }`,
                )
                .join(' · ')}
            </p>
          )}
          <div className="sr-math-standard">
            <span>{t(locale, 'exercise.standard')}</span>
            <p>{result.displayAnswer}</p>
          </div>
        </div>
      )}
    </div>
  )
}
