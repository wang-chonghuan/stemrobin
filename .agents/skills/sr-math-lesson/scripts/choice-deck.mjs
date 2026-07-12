function conciseAnswer(question) {
  if (Array.isArray(question.accept) && question.accept.length) return String(question.accept[0]).trim()
  const text = String(question.answer ?? '')
    .replace(/^参考讲法[:：]?\s*/, '')
    .split(/[。；\n]/)[0]
    .trim()
  return text || '以上说法正确。'
}

function distractors(question, correct, count) {
  const byType = {
    辨认: ['只看外形相同的部分，不按定义判断。', '把括号里的部分逐个拆开来数。'],
    表示: ['把题目中的符号省略，不检查能否还原原式。', '只写数值，不保留符号或位置。'],
    操作: ['只处理第一步，后面的项保持不变。', '把加法层和乘法层混在一起处理。'],
    反推: ['只看结果表面，不回代检查。', '任选一个看起来相近的式子。'],
    辨错: ['这一步没问题，因为结果看起来更简单。', '只要最后答案正确，中间步骤都可以忽略。'],
    说理: ['只给结论，不需要按定义说明理由。', '把两个相关概念当成同一个概念。'],
  }
  const fallbacks = ['无法从题意确定。', '只按表面形式判断，不检查定义。', '把不同层次的对象当成同一类。']
  const candidates = [...(byType[question.type] ?? []), ...fallbacks]
  const out = []
  for (const candidate of candidates) {
    if (candidate !== correct && !out.includes(candidate)) out.push(candidate)
    if (out.length === count) return out
  }
  let n = 1
  while (out.length < count) {
    const candidate = `与正确结论不同的判断 ${n++}。`
    if (candidate !== correct && !out.includes(candidate)) out.push(candidate)
  }
  return out
}

function rotate(values, offset) {
  const size = values.length
  return values.map((_, index) => values[(index - offset + size) % size])
}

export function buildChoiceDeck(items) {
  let fiveOptionAssigned = false
  return items.map((question) => {
    if (question.answer_mode === 'choice') {
      return { ...question, accept: null }
    }
    const correct = conciseAnswer(question)
    const optionCount = fiveOptionAssigned ? 4 : 5
    fiveOptionAssigned = true
    const source = [correct, ...distractors(question, correct, optionCount - 1)]
    const correctIndex = Number(question.ord ?? 1) % source.length
    const options = rotate(source, correctIndex)
    return {
      ...question,
      answer_mode: 'choice',
      accept: null,
      options,
      correct_index: correctIndex,
    }
  })
}

export function immutableSnapshot(items) {
  return items.map((question) => ({
    ord: question.ord,
    prompt: question.prompt,
    type: question.type,
    layer: question.layer ?? null,
    review_of: question.review_of ?? null,
    answer: question.answer,
  }))
}
