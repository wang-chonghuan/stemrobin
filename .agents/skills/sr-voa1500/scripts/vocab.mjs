// sr-voa1500 — VOA1500 vocabulary gate (STEMROBIN-80).
//
// Enforces the charter ruling "英文词元不得超出 VOA1500(允许其词形变化、专有名词、数字)":
// every word of a generated passage must resolve to a headword in
// resources/content/voa1500-wordlist.json, or be an allowed exception (proper name /
// number). A word that resolves to nothing is reported, never silently accepted —
// the author fixes the text, the gate does not widen.
//
// Inflection handling is rule-based + a small irregular map. Deliberately no
// stemming library: a dependency is inadmissible when the existing stack suffices
// (charter · no gratuitous dependencies), and a transparent rule set is auditable.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

// Common irregulars whose base form no suffix rule can recover.
const IRREGULAR = new Map(Object.entries({
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  went: 'go', gone: 'go', goes: 'go',
  said: 'say', saw: 'see', seen: 'see', made: 'make', took: 'take', taken: 'take',
  came: 'come', got: 'get', gave: 'give', given: 'give', knew: 'know', known: 'know',
  thought: 'think', told: 'tell', found: 'find', felt: 'feel', left: 'leave',
  put: 'put', ran: 'run', sat: 'sit', stood: 'stand', took_: 'take', won: 'win',
  wrote: 'write', written: 'write', read: 'read', heard: 'hear', held: 'hold',
  kept: 'keep', lost: 'lose', met: 'meet', paid: 'pay', sold: 'sell', sent: 'send',
  spoke: 'speak', spoken: 'speak', spent: 'spend', taught: 'teach', brought: 'bring',
  bought: 'buy', built: 'build', caught: 'catch', chose: 'choose', drove: 'drive',
  ate: 'eat', eaten: 'eat', fell: 'fall', flew: 'fly', forgot: 'forget', grew: 'grow',
  began: 'begin', begun: 'begin', broke: 'break', broken: 'break', became: 'become',
  children: 'child', men: 'man', women: 'woman', people: 'people', feet: 'foot',
  teeth: 'tooth', mice: 'mouse', better: 'good', best: 'good', worse: 'bad',
  worst: 'bad', more: 'more', most: 'most', us: 'we', him: 'he', her: 'she',
  them: 'they', its: 'it', his: 'he', hers: 'she', theirs: 'they', ours: 'we',
  their: 'they', my: 'my', mine: 'my', your: 'your', yours: 'your', me: 'me',
  cannot: 'can', // written as one word; both halves are in-list
}))

// Spelled-out numbers. The book files these under the "Numbers, Days, Months"
// appendix, which is NOT part of the 1541-word target set — but the release-gate
// ruling allows 数字 as an exception alongside inflections and proper names, and a
// child's story cannot avoid them. Allowed in running text, never counted as coverage.
const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
  'billion', 'trillion', 'first', 'second', 'third',
])

// Candidate base forms for a surface word, cheapest first.
export function lemmaCandidates(w) {
  const s = w.toLowerCase().replace(/[’]/g, "'")
  const out = [s]
  const irr = IRREGULAR.get(s)
  if (irr) out.push(irr)
  const push = (x) => { if (x && x.length > 1 && !out.includes(x)) out.push(x) }

  if (s.endsWith("'s") || s.endsWith("s'")) push(s.replace(/'s$|s'$/, ''))
  if (s.endsWith('ies')) push(s.slice(0, -3) + 'y')
  if (s.endsWith('es')) { push(s.slice(0, -2)); push(s.slice(0, -1)) }
  if (s.endsWith('s')) push(s.slice(0, -1))
  if (s.endsWith('ied')) push(s.slice(0, -3) + 'y')
  if (s.endsWith('ed')) {
    push(s.slice(0, -2)); push(s.slice(0, -1))
    if (/([bdgklmnprt])\1ed$/.test(s)) push(s.slice(0, -3)) // stopped -> stop
  }
  if (s.endsWith('ing')) {
    push(s.slice(0, -3)); push(s.slice(0, -3) + 'e')
    if (/([bdgklmnprt])\1ing$/.test(s)) push(s.slice(0, -4)) // running -> run
  }
  if (s.endsWith('ier')) push(s.slice(0, -3) + 'y')   // happier -> happy
  if (s.endsWith('iest')) push(s.slice(0, -4) + 'y')  // happiest -> happy
  if (s.endsWith('er')) {
    push(s.slice(0, -2)); push(s.slice(0, -1))
    if (/([bdgklmnprt])\1er$/.test(s)) push(s.slice(0, -3)) // bigger -> big
  }
  if (s.endsWith('est')) {
    push(s.slice(0, -3)); push(s.slice(0, -2))
    if (/([bdgklmnprt])\1est$/.test(s)) push(s.slice(0, -4)) // hottest -> hot
  }
  if (s.endsWith('ly')) push(s.slice(0, -2))
  if (s.endsWith('ily')) push(s.slice(0, -3) + 'y')   // easily -> easy
  if (s.endsWith('ry')) push(s.slice(0, -2) + 'er')   // hungry -> hunger, angry -> anger
  return out
}

export function loadVocab() {
  const path = join(repoRoot(), 'resources/content/voa1500-wordlist.json')
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  // headword -> canonical entry key. Multi-word headwords ("air force", "a (an)")
  // also register their component words so the gate accepts them in running text.
  const index = new Map()
  for (const e of doc.entries) {
    const key = e.word.toLowerCase()
    index.set(key, key)
    for (const part of key.replace(/[()]/g, ' ').split(/[\s/]+/)) {
      if (part && !index.has(part)) index.set(part, key)
    }
  }
  const pos = new Map(doc.entries.map((e) => [e.word.toLowerCase(), e.pos]))
  return { index, pos, count: doc.entries.length, entryKeys: doc.entries.map((e) => e.word.toLowerCase()) }
}

// Resolve one surface word to the wordlist entry it covers, or null.
export function resolve(word, vocab) {
  for (const cand of lemmaCandidates(word)) {
    const hit = vocab.index.get(cand)
    if (hit) return hit
  }
  return null
}

export function words(text) {
  return text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []
}

// Check a whole passage. `properNames` are author-declared allowed proper nouns.
// Returns the covered entry keys and any out-of-vocabulary surface words.
export function checkPassage(text, vocab, properNames = []) {
  const allowed = new Set(properNames.map((n) => n.toLowerCase()))
  const covered = new Set()
  const oov = []
  for (const w of words(text)) {
    const lw = w.toLowerCase()
    if (allowed.has(lw)) continue
    if (/^\d+$/.test(w) || NUMBER_WORDS.has(lw)) continue
    const hit = resolve(w, vocab)
    if (hit) covered.add(hit)
    else oov.push(w)
  }
  return { covered, oov }
}
