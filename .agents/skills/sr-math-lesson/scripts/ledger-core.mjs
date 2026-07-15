// sr-math-lesson — shared ledger validation core (SSOT for closure).
// One implementation used by both the CLI checker (check-ledger.mjs) and the
// deterministic DB saver (save-ledger.mjs) so the prerequisite-closure rule is
// never re-implemented. Pure: takes a parsed ledger document, returns problems.
//
// Rules enforced (unchanged from the historical check-ledger.mjs):
//   - schema (subject=math, integer stage, theme, model, assumed[], lessons[])
//   - lesson id shape math-s<stage>-NN, unique, strictly increasing order
//   - genre/status enums, core_idea, introduces/consumes arrays
//   - 概念课 needs >=2 boundary_cases
//   - term ownership uniqueness (one lesson owns each introduced term)
//   - prerequisite closure (every consumed term introduced earlier or assumed)

export const GENRES = ['概念课', '方法课', '练习课']
export const STATUSES = ['planned', 'generated', 'published']

// Validate a parsed ledger document. Returns { problems: string[], ownedBy: Map, assumedTerms: Set }.
// problems is empty when the ledger is valid.
export function validateLedger(ledger) {
  const problems = []
  if (ledger.subject !== 'math') problems.push('subject must be "math"')
  if (!Number.isInteger(ledger.stage)) problems.push('stage must be an integer')
  if (!ledger.theme) problems.push('missing theme')
  if (!ledger.model || ledger.model.length < 10) problems.push("missing/empty model (the stage's central mental model)")
  if (!Array.isArray(ledger.assumed)) problems.push('assumed must be an array')
  if (!Array.isArray(ledger.lessons) || !ledger.lessons.length) problems.push('lessons must be a non-empty array')
  // Fatal schema problems: stop before per-lesson checks (mirror check-ledger.mjs).
  if (problems.length) return { problems, ownedBy: new Map(), assumedTerms: new Set() }

  const assumedTerms = new Set()
  for (const [i, a] of ledger.assumed.entries()) {
    if (!a.concept || !a.from) problems.push(`assumed[${i}]: concept/from required`)
    else assumedTerms.add(a.concept)
    if (a.from === 'GAP' && !a.note) problems.push(`assumed[${i}] (${a.concept}): GAP entries need a note`)
  }

  const seenIds = new Set()
  const ownedBy = new Map() // term -> lesson id
  let prevOrder = 0
  for (const [i, l] of ledger.lessons.entries()) {
    const tag = `lessons[${i}] (${l.id || '?'})`
    if (!l.id || !new RegExp(`^math-s${ledger.stage}-\\d{2}$`).test(l.id)) problems.push(`${tag}: id must look like math-s${ledger.stage}-03`)
    if (seenIds.has(l.id)) problems.push(`${tag}: duplicate id`)
    seenIds.add(l.id)
    if (!Number.isInteger(l.order) || l.order <= prevOrder) problems.push(`${tag}: order must be a strictly increasing integer`)
    prevOrder = l.order ?? prevOrder
    if (!l.title) problems.push(`${tag}: missing title`)
    if (!GENRES.includes(l.genre)) problems.push(`${tag}: genre must be one of ${GENRES.join('|')}`)
    if (!STATUSES.includes(l.status)) problems.push(`${tag}: status must be one of ${STATUSES.join('|')}`)
    if (!l.core_idea) problems.push(`${tag}: missing core_idea`)
    if (!Array.isArray(l.introduces)) problems.push(`${tag}: introduces must be an array (may be empty for 练习课)`)
    if (!Array.isArray(l.consumes)) problems.push(`${tag}: consumes must be an array`)
    if (l.genre === '概念课' && (!Array.isArray(l.boundary_cases) || l.boundary_cases.length < 2))
      problems.push(`${tag}: 概念课 needs >=2 boundary_cases`)

    for (const intro of l.introduces || []) {
      if (!intro.term || !['概念', '方法'].includes(intro.kind)) { problems.push(`${tag}: introduces entries need {term, kind:概念|方法}`); continue }
      if (ownedBy.has(intro.term)) problems.push(`${tag}: term "${intro.term}" already introduced by ${ownedBy.get(intro.term)}`)
      if (assumedTerms.has(intro.term)) problems.push(`${tag}: term "${intro.term}" is already in assumed`)
    }
    for (const c of l.consumes || []) {
      if (!ownedBy.has(c) && !assumedTerms.has(c))
        problems.push(`${tag}: consumes "${c}" — not introduced by any earlier lesson and not in assumed (closure violation)`)
    }
    // register AFTER consuming so a lesson cannot consume its own introductions
    for (const intro of l.introduces || []) if (intro.term) ownedBy.set(intro.term, l.id)
  }
  return { problems, ownedBy, assumedTerms }
}

// The set of terms speakable in a lesson: assumed + everything introduced by
// strictly-earlier lessons. Used by the exercise review_of closure check.
export function earlierTermsFor(ledger, lessonId) {
  const idx = ledger.lessons.findIndex((l) => l.id === lessonId)
  const terms = new Set((ledger.assumed || []).map((a) => a.concept))
  if (idx === -1) return { idx, terms }
  for (const l of ledger.lessons.slice(0, idx)) for (const t of l.introduces || []) terms.add(t.term)
  return { idx, terms }
}
