import { Check, CheckCircle2, Eye, Info, LoaderCircle, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { t, type Locale } from '~/lib/i18n'
import type { ExerciseAnswerSpec, ExerciseGridSpec, PartInputKind } from '~/lib/lessons'
import { GridAnswerField } from '~/components/grid-answer-field'
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
  boundingRect?: { top: number; height: number }
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
  window.setTimeout(() => {
    const scroller = field?.closest<HTMLElement>('.sr-d-scroll')
    if (!field || !scroller) return
    const fieldRect = field.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    const viewport = window.visualViewport
    const viewportBottom = viewport
      ? viewport.offsetTop + viewport.height
      : window.innerHeight
    const keyboardRect = keyboard()?.boundingRect
    const keyboardTop =
      keyboardRect && keyboardRect.height > 0 ? keyboardRect.top : viewportBottom
    const visibleTop = scrollerRect.top + 12
    const visibleBottom =
      Math.min(scrollerRect.bottom, viewportBottom, keyboardTop) - 12
    if (fieldRect.bottom > visibleBottom) {
      scroller.scrollBy({
        top: fieldRect.bottom - visibleBottom,
        behavior: 'smooth',
      })
    } else if (fieldRect.top < visibleTop) {
      scroller.scrollBy({
        top: fieldRect.top - visibleTop,
        behavior: 'smooth',
      })
    }
  }, 180)
}

// One blank whose answer is a plain number. A formula editor can express these
// too, but it makes the learner assemble a digit out of a symbol palette; a
// number pad is what the phone already has. `inputMode="decimal"` opens it, and
// the sign toggle supplies the minus that pad does not carry.
function NumberInput({
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
  const [value, setValue] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) ?? ''
    setValue(stored)
    onValue(index, stored)
  }, [index, onValue, storageKey])

  function commit(next: string) {
    setValue(next)
    localStorage.setItem(storageKey, next)
    onValue(index, next)
  }

  return (
    <div className="sr-math-part">
      <div className="sr-math-answer-head">
        <span className="sr-math-answer-label">{label}</span>
        <div className="sr-math-modes" role="group">
          <button
            type="button"
            disabled={locked}
            aria-label={t(locale, 'exercise.sign')}
            onClick={() =>
              commit(value.startsWith('-') ? value.slice(1) : `-${value}`)
            }
          >
            ±
          </button>
        </div>
      </div>
      <div className="sr-math-field-host">
        <input
          className="sr-num-field"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          readOnly={locked}
          value={value}
          aria-label={t(locale, 'exercise.answer')}
          placeholder={t(locale, 'exercise.answer.placeholder')}
          onChange={(e) => commit(e.target.value)}
        />
      </div>
    </div>
  )
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
      field.placeholder = `\\text{${t(locale, 'exercise.answer.placeholder')}}`
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
    fieldRef.current?.focus({ preventScroll: true })
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
  grid,
}: {
  lessonId: string
  exercise: string
  storageKey: string
  locale: Locale
  answerSpec?: ExerciseAnswerSpec
  grid?: ExerciseGridSpec
}) {
  const fieldCount = answerSpec?.grading === 'auto' ? answerSpec.parts.length : 1
  const [values, setValues] = useState<string[]>(() => Array(fieldCount).fill(''))
  const [result, setResult] = useState<TextbookAnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // How many times this learner has submitted a wrong answer to THIS exercise.
  // The first wrong one is not the end of the exercise — it is the moment the
  // learner is most able to find their own slip, so the standard answer waits.
  const [wrongTries, setWrongTries] = useState(0)

  useEffect(() => {
    setValues(Array(fieldCount).fill(''))
    setResult(null)
    setError('')
    setWrongTries(0)
  }, [exercise, fieldCount, lessonId])

  const onValue = useCallback((index: number, value: string) => {
    setValues((current) => {
      const next = [...current]
      next[index] = value
      return next
    })
  }, [])

  async function submit() {
    if (!answerSpec || submitting || finished) return
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
        if (response.verdict === 'incorrect') setWrongTries((n) => n + 1)
        keyboard()?.hide({ animate: true })
      }
    } catch {
      setError(t(locale, 'err.network'))
    } finally {
      setSubmitting(false)
    }
  }

  const graded = result != null && !('error' in result)
  // A first wrong answer leaves the exercise open: fields stay editable and the
  // submit button stays. Right, self-checked, or wrong twice — that closes it.
  const finished = graded && !(result.verdict === 'incorrect' && wrongTries < 2)
  const retrying = graded && !finished

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
      {grid ? (
        <GridAnswerField
          grid={grid}
          locale={locale}
          locked={finished}
          standard={
            finished && graded && result.verdict !== 'ungraded'
              ? result.parts.map((part) => part.standard)
              : undefined
          }
          onValues={onValue}
        />
      ) : (
      Array.from({ length: fieldCount }, (_, index) => {
        const part = answerSpec?.parts[index]
        // No part spec means an ungraded exercise's single free blank — it can
        // hold anything, so it keeps the math field.
        const kind: PartInputKind = part?.input ?? 'math'
        const Input = kind === 'number' ? NumberInput : MathInput
        return (
          <Input
            key={index}
            index={index}
            storageKey={`${storageKey}:${index}`}
            locale={locale}
            locked={finished}
            onValue={onValue}
            label={
              <>
                {/* The part's own name IS the label ("M 向右", "1)"). Appending
                    "my answer" to it just says the same thing twice; the generic
                    wording is only for a blank that has no name of its own. */}
                {part?.label || t(locale, 'exercise.answer')}
                {part?.unit && <span className="sr-math-unit"> · {part.unit}</span>}
              </>
            }
          />
        )
      }))}

      {answerSpec && !finished && (
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
                : retrying
                  ? t(locale, 'exercise.resubmit')
                  : t(locale, 'exercise.submit')}
          </button>
        </div>
      )}

      {error && <p className="sr-math-error">{error}</p>}

      {graded && (
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
          {retrying ? (
            // Pacing, not secrecy: this learner is allowed to see the standard
            // answer for this exercise — just not before their second try.
            <p className="sr-math-retry">{t(locale, 'exercise.tryAgain')}</p>
          ) : (
            <div className="sr-math-standard">
              <span>{t(locale, 'exercise.standard')}</span>
              <p>{result.displayAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
