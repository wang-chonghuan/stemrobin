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
  came: 'come', got: 'get', gotten: 'get', gave: 'give', given: 'give', knew: 'know',
  known: 'know', thought: 'think', told: 'tell', found: 'find', felt: 'feel',
  left: 'leave', put: 'put', ran: 'run', sat: 'sit', stood: 'stand', won: 'win',
  wrote: 'write', written: 'write', read: 'read', heard: 'hear', held: 'hold',
  kept: 'keep', lost: 'lose', met: 'meet', paid: 'pay', sold: 'sell', sent: 'send',
  spoke: 'speak', spoken: 'speak', spent: 'spend', taught: 'teach', brought: 'bring',
  bought: 'buy', built: 'build', caught: 'catch', chose: 'choose', chosen: 'choose',
  drove: 'drive', driven: 'drive', ate: 'eat', eaten: 'eat', fell: 'fall',
  fallen: 'fall', flew: 'fly', flown: 'fly', forgot: 'forget', forgotten: 'forget',
  grew: 'grow', grown: 'grow', began: 'begin', begun: 'begin', broke: 'break',
  broken: 'break', became: 'become',
  // more irregular verb pasts/participles an author reaches for (STEMROBIN-94).
  slept: 'sleep', woke: 'wake', woken: 'wake', rode: 'ride', ridden: 'ride',
  hid: 'hide', hidden: 'hide', blew: 'blow', blown: 'blow', threw: 'throw',
  thrown: 'throw', drew: 'draw', drawn: 'draw', wore: 'wear', worn: 'wear',
  tore: 'tear', torn: 'tear', shook: 'shake', shaken: 'shake', shot: 'shoot',
  rose: 'rise', risen: 'rise', shone: 'shine', swam: 'swim', swum: 'swim',
  sang: 'sing', sung: 'sing', drank: 'drink', drunk: 'drink', stole: 'steal',
  stolen: 'steal', led: 'lead', laid: 'lay', lain: 'lie', hung: 'hang', dug: 'dig',
  stuck: 'stick', struck: 'strike', understood: 'understand', lent: 'lend',
  meant: 'mean', slid: 'slide', froze: 'freeze', frozen: 'freeze', rang: 'ring',
  rung: 'ring', dying: 'die', lying: 'lie', tying: 'tie',
  // irregular plurals
  children: 'child', men: 'man', women: 'woman', people: 'people', feet: 'foot',
  teeth: 'tooth', mice: 'mouse', geese: 'goose', selves: 'self',
  // irregular comparatives
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', further: 'far',
  farther: 'far', more: 'more', most: 'most',
  // object / possessive / reflexive pronouns. VOA1500 lists I/you/he/she/it/we/they
  // but not my/your/his/her/their/its/me/him/them/myself/… — English cannot be written
  // without them and the ruling allows inflected forms, so map each to its in-list base
  // rather than to itself (which resolved to nothing).
  us: 'we', him: 'he', her: 'she', them: 'they', its: 'it', his: 'he', hers: 'she',
  theirs: 'they', ours: 'we', their: 'they', my: 'i', mine: 'i', me: 'i',
  your: 'you', yours: 'you', whom: 'who', whose: 'who',
  myself: 'i', yourself: 'you', yourselves: 'you', himself: 'he', herself: 'she',
  itself: 'it', ourselves: 'we', themselves: 'they', oneself: 'one',
  // past-tense modals: genuine inflections whose base is in-list, but not headwords
  // themselves (the list has can/will/may, not could/would/might).
  could: 'can', would: 'will', might: 'may',
  cannot: 'can', // written as one word; both halves are in-list
}))

// Contractions resolve to their head word (policy: RESOLVE, see SKILL.md · known-gaps.json).
// The generic path below splits any surface form at the apostrophe and resolves the part
// before it; this map is only for contractions whose head is spelled differently from the
// word before the apostrophe (won't≠wo, can't's negation, o'clock, let's).
const CONTRACTION = new Map(Object.entries({
  "won't": 'will', "can't": 'can', "o'clock": 'clock',
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

  // Contractions (I'm, don't, it's, we'll, isn't, o'clock…). Policy is RESOLVE: strip the
  // enclitic and keep the head, which is itself run through IRREGULAR — so `isn't` → `is`
  // → `be` and `hasn't` → `has` → `have`. `i` and `a` are real one-letter headwords, so the
  // contraction path uses its own push without the length guard. A few heads are spelled
  // differently from the text before the apostrophe (won't→will) and come from CONTRACTION.
  // This only *offers* candidates: a contraction of an out-of-list word still resolves to
  // nothing and still fails the gate.
  const pushHead = (x) => {
    if (!x || out.includes(x)) return
    out.push(x)
    const ir = IRREGULAR.get(x)
    if (ir && !out.includes(ir)) out.push(ir)
  }
  if (s.includes("'")) {
    pushHead(CONTRACTION.get(s))
    if (s.endsWith("n't")) pushHead(s.slice(0, -3))          // don't->do, isn't->is->be
    else if (/'(m|re|ve|ll|d)$/.test(s)) pushHead(s.slice(0, s.indexOf("'"))) // i'm->i, we'll->we
    else if (s.endsWith("'s") && !s.endsWith("s's")) pushHead(s.slice(0, -2)) // it's->it, let's->let
  }

  if (s.endsWith("'s") || s.endsWith("s'")) {
    const base = s.replace(/'s$|s'$/, '')
    push(base); push(IRREGULAR.get(base)) // men's -> men -> man
  }
  if (s.endsWith("'")) { push(s.slice(0, -1)); push(IRREGULAR.get(s.slice(0, -1))) } // boss' -> boss, men' -> man
  if (s.endsWith('ies')) push(s.slice(0, -3) + 'y')
  if (s.endsWith('ves')) { push(s.slice(0, -3) + 'f'); push(s.slice(0, -3) + 'fe') } // knives->knife, halves->half
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
  if (s.endsWith('ically')) push(s.slice(0, -4))      // tragically -> tragic, publically -> public
  if (s.endsWith('ally')) push(s.slice(0, -4) + 'al') // finally -> final
  if (s.endsWith('ly')) {
    push(s.slice(0, -2))                              // quickly -> quick
    push(s.slice(0, -2) + 'le')                       // simply -> simple, gently -> gentle, terribly -> terrible
    push(s.slice(0, -2) + 'e')                        // truly -> true
  }
  if (s.endsWith('ily')) push(s.slice(0, -3) + 'y')   // easily -> easy
  if (s.endsWith('ry')) push(s.slice(0, -2) + 'er')   // hungry -> hunger, angry -> anger
  // adjectival -y (sleepy, dirty, lucky). Only after a consonant and only onto a stem of
  // 3+ letters, or the rule starts inventing lemmas for words that merely end in y:
  // hey -> he, toy -> to, day -> da.
  if (/[^aeiou]y$/.test(s) && s.length >= 4) {
    push(s.slice(0, -1))                              // sleepy -> sleep, dirty -> dirt
    if (/([bdgklmnprt])\1y$/.test(s)) push(s.slice(0, -2)) // funny -> fun, sunny -> sun
  }
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

// Surface forms that a suffix rule can decompose into an in-list word but that are a
// separate lexeme the list simply does not have. Without this they would be silently
// accepted, and an author would ship a word the learner's 1541-word world does not
// contain. Keep this set tiny and evidenced — it is a correction, not a policy dial.
const FALSE_FRIEND = new Set([
  'evening', // "even" + -ing; VOA1500 has no "evening" — write "night"
])

// Resolve one surface word to the wordlist entry it covers, or null.
export function resolve(word, vocab) {
  const s = word.toLowerCase().replace(/[’]/g, "'")
  if (FALSE_FRIEND.has(s) && !vocab.index.has(s)) return null
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
    const lw = w.toLowerCase().replace(/[’]/g, "'")
    // a declared proper name is allowed in its possessive form too ("Anna's book"),
    // otherwise every author hits this on their first dialogue.
    if (allowed.has(lw) || allowed.has(lw.replace(/'s$|s'$|'$/, ''))) continue
    if (/^\d+$/.test(w) || NUMBER_WORDS.has(lw)) continue
    const hit = resolve(w, vocab)
    if (hit) covered.add(hit)
    else oov.push(w)
  }
  return { covered, oov }
}
