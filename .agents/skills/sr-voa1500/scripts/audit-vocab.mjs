#!/usr/bin/env node
// sr-voa1500 — VOA1500 wordlist + lemma-resolver audit (STEMROBIN-94).
//
// Lesson authors were finding holes one lesson at a time: `my` did not resolve, `I'm`
// did not resolve, `into` turned out to be absent from the list. This script finds the
// whole set in one pass instead, by stress-testing `vocab.mjs` against a corpus of
// ordinary English a children's-course author would plausibly type:
//
//   1. every regular inflection of every wordlist headword, generated here
//      (plural/3sg -s/-es/-ies, past -ed/-ied/doubled, progressive -ing, comparative
//       -er/-est, adverbial -ly, possessive 's/s');
//   2. a hand list of irregular verb/noun forms;
//   3. a hand list of very common function words, contractions and everyday
//      children's-course nouns an author reaches for without thinking.
//
// Every corpus item carries the in-list base it is supposed to fall back to (or null).
// A failure is then classified without judgement calls:
//
//   INFLECTION — the base IS a wordlist headword, so the surface form is a legal
//                inflection and the resolver simply failed to undo it → resolver bug.
//   GAP        — no in-list base exists → the 1541-word list genuinely lacks the word.
//                Authors must avoid it; these are emitted to known-gaps.json.
//
// Usage:
//   node .agents/skills/sr-voa1500/scripts/audit-vocab.mjs            # report
//   node .agents/skills/sr-voa1500/scripts/audit-vocab.mjs --verbose  # list every failure
//   node .agents/skills/sr-voa1500/scripts/audit-vocab.mjs --emit-gaps  # write known-gaps.json
//
// Exit code is 1 if any INFLECTION failure or any regression check fails; a GAP list is
// information, not a failure.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadVocab, resolve, checkPassage, repoRoot } from './vocab.mjs'

const argv = process.argv.slice(2)
const VERBOSE = argv.includes('--verbose')
const EMIT = argv.includes('--emit-gaps')

const vocab = loadVocab()
const inList = (w) => (w ? vocab.index.has(w.toLowerCase()) : false)

// ---------------------------------------------------------------------------
// 1. generated inflections
// ---------------------------------------------------------------------------

// crude CVC test for consonant doubling: single final consonant, single vowel before it,
// short stem. Over-generating a doubled form is harmless — the resolver must undo both.
const doubles = (w) =>
  w.length <= 6 &&
  /[^aeiou][aeiou][bdfglmnprstvz]$/.test(w) &&
  !/[aeiou][aeiou][^aeiou]$/.test(w)

function pluralForms(w) {
  const out = []
  if (/(s|x|z|ch|sh)$/.test(w)) out.push(w + 'es')
  else if (/[^aeiou]y$/.test(w)) out.push(w.slice(0, -1) + 'ies')
  else if (/[^aeiou]o$/.test(w)) out.push(w + 'es', w + 's')
  else out.push(w + 's')
  if (/fe$/.test(w)) out.push(w.slice(0, -2) + 'ves')
  else if (/[^f]f$/.test(w)) out.push(w.slice(0, -1) + 'ves')
  return out
}

function pastForms(w) {
  if (/e$/.test(w)) return [w + 'd']
  if (/[^aeiou]y$/.test(w)) return [w.slice(0, -1) + 'ied']
  if (doubles(w)) return [w + w.slice(-1) + 'ed']
  return [w + 'ed']
}

function ingForms(w) {
  if (/ie$/.test(w)) return [w.slice(0, -2) + 'ying']
  if (/[^eo]e$/.test(w)) return [w.slice(0, -1) + 'ing']
  if (doubles(w)) return [w + w.slice(-1) + 'ing']
  return [w + 'ing']
}

function degreeForms(w) {
  if (/e$/.test(w)) return [w + 'r', w + 'st']
  if (/[^aeiou]y$/.test(w)) return [w.slice(0, -1) + 'ier', w.slice(0, -1) + 'iest']
  if (doubles(w)) return [w + w.slice(-1) + 'er', w + w.slice(-1) + 'est']
  return [w + 'er', w + 'est']
}

function adverbForms(w) {
  if (/[^aeiou]y$/.test(w)) return [w.slice(0, -1) + 'ily']
  if (/[^aeiou]le$/.test(w)) return [w.slice(0, -1) + 'y']       // simple -> simply
  if (/ic$/.test(w)) return [w + 'ally']                          // basic -> basically
  if (/ue$/.test(w)) return [w.slice(0, -1) + 'ly']               // true -> truly
  if (/l$/.test(w)) return [w + 'ly']                             // full -> fully
  return [w + 'ly']
}

const possessiveForms = (w) => [w + "'s", (/s$/.test(w) ? w + "'" : w + "'s")]

// "ad." is the list's catch-all for adjective/adverb/article/preposition, so a few of its
// entries take no comparative and no -ly. Excluding them keeps the corpus to forms an
// author could actually type ("yesser" is not English and proves nothing about the gate).
const NON_GRADABLE = new Set([
  'yes', 'no', 'a', 'an', 'the', 'all', 'both', 'each', 'every', 'this', 'that',
  'these', 'those', 'some', 'any', 'many', 'much', 'more', 'most', 'here', 'there',
  'now', 'then', 'today', 'tomorrow', 'yesterday', 'always', 'never', 'again',
])

const corpus = []
// `base` is the in-list headword the form must fall back to (null when there is none);
// `declared` keeps the intended base even when it is itself absent, so a gap like `woke`
// can say "inflection of wake, which is also absent" instead of a bare shrug.
const add = (form, base, kind, declared = base) =>
  corpus.push({ form, base, kind, declared })

// Gate generated inflections by part of speech so the corpus is *plausible* author
// input, not a combinatorial explosion of non-words: a noun does not take -ed/-ing, an
// article does not take -er. Oxford tags a word with every part of speech it has
// ("n., v.", "adj. , adv."), so membership is tested per tag, not by equality; this only
// prunes the obvious nonsense (crisis -> "crisissed", people -> "peoply"); a little
// over-generation inside a category is harmless because a non-word that never appears in
// real text costs nothing whether it resolves or not.
for (const key of vocab.entryKeys) {
  const tags = (vocab.pos.get(key) ?? '').split(/[,/]/).map((t) => t.trim())
  const isVerb = tags.includes('v.')
  const isNoun = tags.includes('n.')
  const isGradable = tags.includes('adj.') || tags.includes('adv.')
  // multi-word / parenthetical headwords ("a (an)", "air force") are inflected through
  // their component words, which loadVocab already registers in the index.
  for (const part of key.replace(/[()]/g, ' ').split(/[\s/]+/)) {
    if (!/^[a-z]{2,}$/.test(part)) continue
    for (const f of possessiveForms(part)) add(f, part, 'possessive')
    if (isNoun || isVerb) for (const f of pluralForms(part)) add(f, part, 'plural/3sg')
    if (isVerb) {
      for (const f of pastForms(part)) add(f, part, 'past')
      for (const f of ingForms(part)) add(f, part, 'progressive')
    }
    if (isGradable && !NON_GRADABLE.has(part)) {
      for (const f of degreeForms(part)) add(f, part, 'comparative')
      for (const f of adverbForms(part)) add(f, part, 'adverb')
    }
  }
}

// ---------------------------------------------------------------------------
// 2. irregular forms an author types without thinking
// ---------------------------------------------------------------------------

const IRREGULAR_CORPUS = {
  // surface form -> the base it inflects (a headword, or null if the base is absent too)
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have', does: 'do', did: 'do', done: 'do',
  went: 'go', gone: 'go', goes: 'go', said: 'say', saw: 'see', seen: 'see',
  made: 'make', took: 'take', taken: 'take', came: 'come', got: 'get', gotten: 'get',
  gave: 'give', given: 'give', knew: 'know', known: 'know', thought: 'think',
  told: 'tell', found: 'find', felt: 'feel', left: 'leave', ran: 'run', sat: 'sit',
  stood: 'stand', won: 'win', wrote: 'write', written: 'write', heard: 'hear',
  held: 'hold', kept: 'keep', lost: 'lose', met: 'meet', paid: 'pay', sold: 'sell',
  sent: 'send', spoke: 'speak', spoken: 'speak', spent: 'spend', taught: 'teach',
  brought: 'bring', bought: 'buy', built: 'build', caught: 'catch', chose: 'choose',
  chosen: 'choose', drove: 'drive', driven: 'drive', ate: 'eat', eaten: 'eat',
  fell: 'fall', fallen: 'fall', flew: 'fly', flown: 'fly', forgot: 'forget',
  forgotten: 'forget', grew: 'grow', grown: 'grow', began: 'begin', begun: 'begin',
  broke: 'break', broken: 'break', became: 'become', slept: 'sleep', woke: 'wake',
  rode: 'ride', ridden: 'ride', hid: 'hide', hidden: 'hide', blew: 'blow',
  blown: 'blow', threw: 'throw', thrown: 'throw', drew: 'draw', drawn: 'draw',
  wore: 'wear', worn: 'wear', tore: 'tear', torn: 'tear', shook: 'shake',
  shaken: 'shake', shot: 'shoot', rose: 'rise', risen: 'rise', shone: 'shine',
  swam: 'swim', swum: 'swim', sang: 'sing', sung: 'sing', drank: 'drink',
  drunk: 'drink', stole: 'steal', stolen: 'steal', led: 'lead', laid: 'lay',
  lain: 'lie', hung: 'hang', dug: 'dig', stuck: 'stick', struck: 'strike',
  understood: 'understand', lent: 'lend', meant: 'mean', slid: 'slide',
  froze: 'freeze', frozen: 'freeze', rang: 'ring', rung: 'ring',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
  mice: 'mouse', geese: 'goose', wives: 'wife', knives: 'knife', leaves: 'leaf',
  lives: 'life', halves: 'half', shelves: 'shelf', thieves: 'thief',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  further: 'far', farther: 'far', dying: 'die', lying: 'lie', tying: 'tie',
  "children's": 'child', "men's": 'man', "people's": 'people',
}
for (const [form, base] of Object.entries(IRREGULAR_CORPUS)) {
  add(form, inList(base) ? base : null, 'irregular', base)
}

// ---------------------------------------------------------------------------
// 3. hand list: function words, contractions, everyday course nouns
//    [surface form, base it inflects (null = its own lexeme), author advice if absent]
// ---------------------------------------------------------------------------

const NOTES = new Map()

const HAND = [
  // --- pronouns and their possessive / object forms -------------------------
  ['my', 'i'], ['me', 'i'], ['mine', 'i'], ['myself', 'i'],
  ['your', 'you'], ['yours', 'you'], ['yourself', 'you'], ['yourselves', 'you'],
  ['him', 'he'], ['his', 'he'], ['himself', 'he'],
  ['her', 'she'], ['hers', 'she'], ['herself', 'she'],
  ['its', 'it'], ['itself', 'it'],
  ['us', 'we'], ['ours', 'we'], ['ourselves', 'we'],
  ['their', 'they'], ['theirs', 'they'], ['them', 'they'], ['themselves', 'they'],
  ['whom', 'who'], ['whose', 'who'],
  // --- determiners / quantifiers -------------------------------------------
  ['another', null, 'use "one more" / "a new ___"'],
  ['each', null], ['both', null], ['either', null, 'reword: "this one or that one"'],
  ['neither', null, 'reword: "not this one and not that one"'],
  ['such', null], ['several', null, 'use "some" / "a few"'], ['enough', null],
  ['any', null], ['none', null, 'use "not any"'],
  ['everyone', null, 'use "all the children" / "everybody" is also absent — reword'],
  ['everybody', null, 'reword: "all of them"'],
  ['everything', null, 'reword: "all of it" / name the things'],
  ['everywhere', null, 'reword: "in every place"'],
  ['someone', null, 'reword: "a person" / "a boy" / "a friend"'],
  ['somebody', null, 'reword: "a person"'],
  ['something', null, 'reword: "a thing"'],
  ['somewhere', null, 'reword: "in some place"'],
  ['anyone', null, 'reword: "any person"'], ['anybody', null, 'reword: "any person"'],
  ['anything', null, 'reword: "any thing"'], ['anywhere', null, 'reword: "any place"'],
  ['nobody', null, 'reword: "no one is / no person"'],
  ['nothing', null, 'reword: "not a thing"'],
  ['nowhere', null, 'reword: "in no place"'],
  // --- prepositions / conjunctions / adverbs --------------------------------
  ['into', null, 'no in-list equivalent; use "in" ("She walks in the room")'],
  ['onto', null, 'use "on" ("He climbs on the box")'],
  ['upon', null, 'use "on"'],
  ['inside', null, 'use "in" / "in the house"'],
  ['outside', null, 'use "out" / "out of the house"'],
  ['within', null, 'use "in"'],
  ['without', null, 'reword: "with no ___" / "does not have"'],
  ['throughout', null, 'use "through" / "all day"'],
  ['toward', null, 'use "to"'], ['towards', null, 'use "to"'],
  ['beside', null, 'use "near" / "next to" (both in list via near/next)'],
  ['besides', null, 'use "also"'],
  ['beyond', null, 'use "past" / "far from"'],
  ['behind', null], ['below', null, 'use "under"'], ['beneath', null, 'use "under"'],
  ['between', null], ['among', null], ['along', null], ['around', null],
  ['across', null], ['against', null], ['above', null], ['under', null],
  ['over', null], ['through', null],
  ['though', null, 'use "but"'], ['although', null, 'use "but"'],
  ['unless', null, 'reword: "if ... not"'], ['until', null], ['till', null, 'use "until"'],
  ['since', null], ['while', null], ['because', null], ['therefore', null, 'use "so"'],
  ['however', null, 'use "but"'], ['instead', null, 'reword: "___ , not ___"'],
  ['perhaps', null, 'use "may" ("It may rain")'],
  ['maybe', null, 'use "may" ("She may come")'],
  ['quite', null, 'use "very"'], ['rather', null, 'use "very" / "more"'],
  ['almost', null], ['already', null], ['still', null], ['yet', null],
  ['soon', null], ['later', 'late'], ['again', null], ['ago', null], ['ever', null],
  ['never', null], ['always', null], ['often', null],
  ['sometimes', null, 'reword: "some days" / "at times"'],
  ['usually', null, 'reword: "most days"'], ['anyway', null, 'drop it'],
  ['together', null], ['ahead', null, 'use "in front"'],
  ['upstairs', null, 'reword: "up the stairs" — "stairs" is absent too'],
  ['downstairs', null, 'reword: "down the stairs"'],
  ['today', null], ['tomorrow', null], ['yesterday', null], ['tonight', null],
  ['everyday', null, 'write "every day" as two words'],
  // --- wh- words ------------------------------------------------------------
  ['where', null, 'ABSENT from the list — ask with "what place" or rewrite the question'],
  ['when', null], ['why', null], ['how', null], ['what', null], ['which', null],
  ['whatever', null, 'reword'], ['whenever', null, 'use "when"'],
  ['wherever', null, 'reword'], ['whoever', null, 'reword'],
  // --- greetings / politeness / interjections -------------------------------
  ['hello', null, 'ABSENT — greet with "good morning" / a name'],
  ['hi', null, 'ABSENT — greet with "good morning" / a name'],
  ['hey', null, 'ABSENT — use the name'],
  ['bye', null, 'ABSENT — use "good night" / "see you"'],
  ['goodbye', null, 'ABSENT — use "good night" / "see you"'],
  ['please', null, 'ABSENT — reword the request'],
  ['sorry', null, 'ABSENT — use "I am sad" / "it was my fault"'],
  ['thanks', 'thank'],
  ['okay', null, 'ABSENT — use "all right" / "good"'],
  ['ok', null, 'ABSENT — use "all right" / "good"'],
  ['yes', null], ['no', null], ['oh', null, 'drop the interjection'],
  ['wow', null, 'drop it or use "very good"'],
  // --- contractions ---------------------------------------------------------
  ["i'm", 'i'], ["i've", 'i'], ["i'll", 'i'], ["i'd", 'i'],
  ["you're", 'you'], ["you've", 'you'], ["you'll", 'you'], ["you'd", 'you'],
  ["he's", 'he'], ["he'll", 'he'], ["he'd", 'he'],
  ["she's", 'she'], ["she'll", 'she'], ["she'd", 'she'],
  ["it's", 'it'], ["it'll", 'it'],
  ["we're", 'we'], ["we've", 'we'], ["we'll", 'we'], ["we'd", 'we'],
  ["they're", 'they'], ["they've", 'they'], ["they'll", 'they'], ["they'd", 'they'],
  ["that's", 'that'], ["there's", 'there'], ["here's", 'here'], ["what's", 'what'],
  ["who's", 'who'], ["let's", 'let'], ["who'll", 'who'],
  ["don't", 'do'], ["doesn't", 'do'], ["didn't", 'do'],
  ["isn't", 'be'], ["aren't", 'be'], ["wasn't", 'be'], ["weren't", 'be'],
  ["haven't", 'have'], ["hasn't", 'have'], ["hadn't", 'have'],
  ["can't", 'can'], ['cannot', 'can'], ["couldn't", 'can'],
  ["won't", 'will'], ["wouldn't", 'will'],
  ["shouldn't", 'should'], ["mustn't", 'must'],
  ["o'clock", 'clock'],
  ['shall', null, 'ABSENT — use "will"'],
  ["shan't", null, 'ABSENT — "shall" is not in the list; use "will not"'],
  // --- everyday children's-course nouns and adjectives ----------------------
  ['teacher', 'teach'], ['homework', null, 'reword: "school work" / "work for school"'],
  ['classroom', null, 'use "class room" as two words, or "room"'],
  ['playground', null, 'use "the field" — "yard" is absent too'],
  ['backpack', null, 'reword: "she carries her books"'], ['notebook', null, 'use "book" / "paper"'],
  ['pencil', null, 'reword: "she writes" — "pen" is absent too'], ['eraser', null, 'reword'],
  ['desk', null, 'reword: "she sits in her place" — "table" is absent too'], ['blackboard', null, 'reword: "the front of the class"'],
  ['breakfast', null, 'reword: "the first meal" / "we eat in the morning"'],
  ['lunch', null, 'reword: "we eat at noon"'],
  ['dinner', null, 'reword: "we eat at night" — "meal" is in the list'],
  ['snack', null, 'use "food"'], ['sandwich', null, 'use "bread"'],
  ['cookie', null, 'use "food" / "sugar" — "cake" is absent too'],
  ['candy', null, 'use "sugar"'], ['apple', null, 'use "fruit"'],
  ['juice', null, 'use "water" / "drink"'],
  ['hungry', 'hunger'], ['thirsty', null, 'reword: "she wants water"'],
  ['sleepy', 'sleep'], ['tired', null, 'reword: "she wants to sleep"'],
  ['angry', 'anger'], ['excited', null, 'use "happy"'],
  ['scared', null, 'use "afraid" / "fear"'],
  ['nervous', null, 'use "afraid"'], ['worried', 'worry'],
  ['lonely', null, 'use "alone" — "lonely" is its own lexeme, not an inflection of it'],
  ['funny', 'fun'], ['silly', null, 'reword'], ['polite', null, 'reword'],
  ['birthday', null, 'reword: "the day she was born"'],
  ['holiday', null, 'use "day off" / name the day'],
  ['weekend', null, 'use "week end" as two words, or name the day'],
  ['afternoon', null, 'reword: "after noon" as two words'],
  ['evening', null, 'use "night"'],
  ['kitchen', null, 'use "room"'], ['bedroom', null, 'reword: "her room"'],
  ['bathroom', null, 'reword: "the wash room"'],
  ['garden', null, 'use "field" / "plant"'], ['park', null, 'use "field"'],
  ['zoo', null, 'use "animal"'], ['puppy', null, 'use "dog"'],
  ['kitten', null, 'use "cat"'], ['rabbit', null, 'use "animal"'],
  ['bicycle', null, 'use "ride" / "wheel"'], ['bike', null, 'use "ride" / "wheel"'],
  ['toy', null, 'use "game" / "ball"'],
  ['ball', null], ['doll', null, 'reword or make it a declared proper name — "toy" is absent too'],
  ['cartoon', null, 'use "television" / "show"'],
  ['phone', null, 'use "telephone"'], ['computer', null], ['television', null],
  ['pocket', null, 'reword — "bag" is absent too'], ['jacket', null, 'use "clothes"'],
  ['hat', null, 'use "clothes"'], ['umbrella', null, 'reword'],
  ['shoes', 'shoe'], ['socks', null, 'use "clothes"'],
  ['nice', null, 'use "good" / "kind"'], ['pretty', null, 'use "lovely"? absent — use "nice" / "fine"'],
  ['busy', null, 'reword: "she has much work"'],
  ['ready', null, 'reword'], ['careful', 'care'], ['carefully', 'care'],
  ['quiet', null], ['loud', null, 'use "sound" / "noise"'],
  ['clean', null], ['dirty', 'dirt'], ['broken', 'break'],
  ['stairs', null, 'reword: "she goes up" / "she goes down"'], ['window', null], ['door', null], ['floor', null],
  ['wall', null], ['chair', null, 'use "seat"'], ['table', null, 'reword: "she puts it down" / use "place"'],
]

for (const [form, base, note] of HAND) {
  add(form, base && inList(base) ? base : null, 'hand', base ?? null)
  if (note) NOTES.set(form, note)
}

// ---------------------------------------------------------------------------
// the committed artifact
// ---------------------------------------------------------------------------

function buildGapsDoc(gaps) {
  return {
    generated:
      'node .agents/skills/sr-voa1500/scripts/audit-vocab.mjs --emit-gaps (STEMROBIN-94). ' +
      'Words a children\'s-course author would plausibly write that resolve to NOTHING in ' +
      'resources/content/course-wordlist.json and are not inflections of anything in it. ' +
      'The gate rejects them; avoid them while writing instead of discovering them at save time.',
    wordlist: `resources/content/course-wordlist.json (${vocab.count} headwords)`,
    contractionPolicy:
      'RESOLVE — contractions are treated as inflections, so authors may write natural ' +
      'spoken English in the 〔对话〕 lessons instead of stilted expansions. vocab.mjs ' +
      "strips the enclitic and resolves the head, running it through the irregular map: " +
      "I'm/I'll/I've/I'd -> i, we're -> we, it's -> it, let's -> let, don't -> do, " +
      "isn't -> is -> be, hasn't -> has -> have, couldn't -> could -> can; won't -> will " +
      "and o'clock -> clock are spelled-out exceptions. This is a lemma rule, not a hole: " +
      'a contraction of an out-of-list word still resolves to nothing and still fails the ' +
      "gate (\"shan't\" fails, because \"shall\" itself is absent).",
    gaps: gaps.map((g) => ({
      form: g.form,
      note:
        NOTES.get(g.form) ??
        (g.declared
          ? `inflection of "${g.declared}", which is itself absent from the list; reword`
          : 'no in-list equivalent; reword'),
    })),
  }
}

// ---------------------------------------------------------------------------
// run the audit
// ---------------------------------------------------------------------------

const seen = new Set()
const failures = []
let tested = 0
for (const item of corpus) {
  const k = item.form + ' ' + (item.base ?? '')
  if (seen.has(k)) continue
  seen.add(k)
  tested++
  if (resolve(item.form, vocab)) continue
  failures.push({ ...item, category: item.base ? 'INFLECTION' : 'GAP' })
}

const inflectionFails = failures.filter((f) => f.category === 'INFLECTION')
const gapFails = failures.filter((f) => f.category === 'GAP')

// ---------------------------------------------------------------------------
// regression checks — the cases lesson authors already paid for, plus proof the
// gate is still a gate.
// ---------------------------------------------------------------------------

const MUST_RESOLVE = [
  ['my', 'i'], ['your', 'you'], ['his', 'he'], ['her', 'she'], ['their', 'they'],
  ['its', 'it'], ['me', 'i'], ['walks', 'walk'], ['running', 'run'],
  ['happier', 'happy'], ['bigger', 'big'], ['cities', 'city'], ['easily', 'easy'],
  ['hungry', 'hunger'], ['cannot', 'can'], ["i'm", 'i'], ["don't", 'do'],
  ["isn't", 'be'], ["can't", 'can'], ["it's", 'it'], ["we'll", 'we'],
]
// Words a children's author could plausibly type that the Oxford A1+A2 list does NOT
// have. The gate must keep rejecting them — this is the proof it is still a gate after
// the wordlist swap (STEMROBIN-100). into/where/hello/homework used to live here: VOA
// lacked them, Oxford has them, which is exactly why the list was replaced.
const MUST_FAIL = [
  'skateboard', 'gymnasium', 'pajamas', 'backpack', 'crayon', 'dinosaur',
  'skateboards', "skateboard's", 'skateboarding', 'gymnasiums',
  // forms a suffix rule could over-eagerly decompose into an in-list word
  "skateboard'", 'skateboardly', 'backpacks', 'crayons',
]

// A form that IS itself a headword must resolve to itself, not be forced back to the
// base a smaller wordlist would have made it fall back to: Oxford lists my/me/his/its/
// running/easily/hungry/cannot in their own right, VOA1500 did not. What the check
// guards is that the form still resolves to *something* legal.
const regressions = []
for (const [form, want] of MUST_RESOLVE) {
  const expect = vocab.index.get(form) ?? want
  const got = resolve(form, vocab)
  if (got !== expect) regressions.push(`resolve(${form}) = ${got ?? 'null'}, want ${expect}`)
}
for (const form of MUST_FAIL) {
  const got = resolve(form, vocab)
  if (got) regressions.push(`resolve(${form}) = ${got}, want null (gate must stay closed)`)
}
// whole-passage behaviour: natural dialogue English passes, real gaps are still caught.
{
  const ok = checkPassage(
    "I'm walking home with my friend Anna. She's happier today because her mother said " +
      "we could play. Don't run, she says. It's five o'clock and Anna's book fell, so I " +
      'gave it back to her. We will study together tomorrow.',
    vocab,
    ['Anna'],
  )
  if (ok.oov.length) regressions.push(`natural passage rejected: ${[...new Set(ok.oov)].join(', ')}`)
  const bad = checkPassage('Anna rides her skateboard to the gymnasium with her backpack.', vocab, ['Anna'])
  for (const w of ['skateboard', 'backpack', 'gymnasium']) {
    if (!bad.oov.includes(w)) regressions.push(`passage gate let "${w}" through`)
  }
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

const byKind = new Map()
for (const f of inflectionFails) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1)

console.log(`course wordlist resolver audit — ${vocab.count} headwords (Oxford A1+A2)`)
console.log(`corpus              ${tested} surface forms`)
console.log(`failures            ${failures.length}`)
console.log(`  INFLECTION (bug)  ${inflectionFails.length}`)
console.log(`  GAP (list lacks)  ${gapFails.length}`)
if (byKind.size) {
  console.log('\nINFLECTION failures by rule:')
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${n}`)
}
if (inflectionFails.length) {
  const show = VERBOSE ? inflectionFails : inflectionFails.slice(0, 40)
  console.log('\nINFLECTION failures (surface -> expected base):')
  for (const f of show) console.log(`  ${f.form.padEnd(20)} -> ${f.base}  [${f.kind}]`)
  if (show.length < inflectionFails.length) console.log(`  ... ${inflectionFails.length - show.length} more (--verbose)`)
}
console.log(`\nGAPs (${gapFails.length}): ${gapFails.map((f) => f.form).join(', ')}`)

console.log('\nregression checks:')
if (regressions.length) for (const r of regressions) console.log(`  FAIL ${r}`)
else console.log(`  ${MUST_RESOLVE.length} must-resolve + ${MUST_FAIL.length} must-fail: all pass`)

if (EMIT) {
  const path = join(repoRoot(), '.agents/skills/sr-voa1500/known-gaps.json')
  writeFileSync(path, JSON.stringify(buildGapsDoc(gapFails), null, 2) + '\n')
  console.log(`\nwrote ${path} (${gapFails.length} gaps)`)
}

process.exit(inflectionFails.length || regressions.length ? 1 : 0)
