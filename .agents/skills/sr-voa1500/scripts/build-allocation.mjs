// Builder for allocation.json (STEMROBIN-86). Deterministic: anchors parsed from the
// human blueprint, remaining words scored against per-lesson theme keywords, then
// mechanically rebalanced into the per-lesson budget. Scratch tool, not repo code.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: '/Users/yong/work/stemrobin-ws/stemrobin', encoding: 'utf8',
}).trim()

const wl = JSON.parse(readFileSync(`${root}/resources/content/voa1500-wordlist.json`, 'utf8'))
const outline = readFileSync(`${root}/.agents/skills/sr-voa1500/outline.md`, 'utf8')

const ALL = wl.entries.map((e) => ({ w: e.word.toLowerCase(), pos: e.pos, def: (e.definition || '').toLowerCase() }))
const BY = new Map(ALL.map((e) => [e.w, e]))
const SYNTH = new Set([6, 12, 18, 24, 30, 36, 42, 48, 54, 60])

// ── incidental: function words that must not sit on a vocab card ──────────────
const FUNC_POS = new Set(['prep.', 'pro.', 'conj.'])
const FUNC_EXTRA = `a (an) the be am is are was were been do does did have has had will would can could may
might must shall should not no yes very too so also more most much many few some any all both each every other
same such than then there here now when where why how what which who whom whose if because but and or as at by
for from in into of off on out over to under up with about after before again against between down during
near since through until while above across along around behind below beside beyond except inside outside
toward upon within without this that these those it its i me my mine you your yours he him his she her hers we
us our ours they them their theirs one two three first second next last only just even still yet ever never
always often sometimes usually almost enough less least own able about`
  .split(/\s+/).filter(Boolean)

const incidentalSet = new Set()
for (const e of ALL) if (FUNC_POS.has(e.pos)) incidentalSet.add(e.w)
for (const w of FUNC_EXTRA) if (BY.has(w)) incidentalSet.add(w)
// multi-word article entry
if (BY.has('a (an)')) incidentalSet.add('a (an)')

// ── anchors: the blueprint's own 新词 examples, per lesson ────────────────────
const anchors = new Map() // n -> [words]
{
  const lines = outline.split('\n')
  let cur = null
  for (const line of lines) {
    const m = line.match(/^(\d{2}) · /)
    if (m) { cur = Number(m[1]); continue }
    const nw = line.match(/^\* 新词: (.+)$/)
    if (nw && cur) {
      const words = nw[1].split('/').map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z][a-z' ()-]*$/.test(s))
      anchors.set(cur, words.filter((w) => BY.has(w) && !incidentalSet.has(w)))
    }
  }
}

// ── per-lesson theme keywords (judgment layer, derived from the blueprint) ────
const K = {
  1:'name family mother father sister brother child parent son daughter old age person people born relative',
  2:'body head hand eye face tooth teeth wash brush clean arm leg finger hair ear nose mouth skin foot neck back',
  3:'morning clothes dress wear ready early late shoe hat coat shirt begin start put on time hurry',
  4:'home room door window bed table chair floor wall house live build apartment inside kitchen furniture',
  5:'work job teacher doctor driver cook office farmer nurse worker like company employ',
  6:'',
  7:'road cross street walk wait careful light traffic safe danger corner sign stop signal accident cars',
  8:'bus bike ride car drive way near far stop travel train station wheel machine engine',
  9:'school class classroom floor wall desk board student big new building study教',
  10:'listen understand answer question ask speak say hear again teach learn repeat explain word talk',
  11:'subject mathematics english study learn book read write easy hard good test grade lesson history science art',
  12:'',
  13:'breakfast egg bread milk water rice hungry drink eat morning food meal cup bowl',
  14:'food fruit apple meat vegetable thirsty full sweet taste like best fish chicken sugar salt',
  15:'kitchen cook cut hot cold pot put fire boil pan oil heat burn knife',
  16:'lunch together share plate spoon delicious taste sit friend more dinner table serve',
  17:'try taste sweet sour salt soft new feel think smell bitter fresh strange',
  18:'order money pay price cheap change welcome cost buy shop restaurant bill',
  19:'shop buy sell expensive cheap dollar need want pay store market goods trade customer',
  20:'way straight turn left right next near far direction corner block find lose map follow',
  21:'bus stop seat ticket free wait get ride passenger line crowd',
  22:'park run jump play grass tree ball slow fast watch game field swing sport climb',
  23:'weather sun rain wind cloud cold warm hot wear need storm snow sky ice dry wet',
  24:'',
  25:'clock hour minute week day night time before after month year morning noon evening today tomorrow yesterday',
  26:'meet free weekend plan when where then together time appointment arrange',
  27:'come invite party sorry maybe love sure hope accept refuse guest visit',
  28:'game turn win lose rule again both fun try play team score compete beat prize',
  29:'kind funny tall short nice smart quiet same friend person young pretty strong brave honest',
  30:'',
  31:'feel happy sad angry afraid tired why because glad sorrow mood hate laugh smile fear',
  32:'please thank welcome excuse sorry polite mind sure kind respect greet',
  33:'wrong right fight forget argue quarrel angry agree blame promise trust',
  34:'help need carry hold open close aid support give lift move bring',
  35:'cry worry better everything care comfort hope kind trouble calm gentle',
  36:'',
  37:'healthy exercise sleep strong keep bad good health body fit rest energy weak',
  38:'sick ill hurt cough fever stomach well pain doctor medicine disease cold suffer',
  39:'fall cut touch danger blood knee sharp hurt careful hospital wound break injure',
  40:'rest medicine take better soon sleep heal treat nurse recover',
  41:'clean dirty throw dust keep wash room wet dry wipe empty',
  42:'',
  43:'season spring summer winter cool change leaf weather hot cold autumn nature',
  44:'flower sky river mountain green grow beautiful tree grass plant seed land field hill lake sea',
  45:'animal pet dog cat bird fish feed sound horse cow sheep wild tail wing',
  46:'yesterday country farm visit trip walk past remember village travel',
  47:'waste trash ground air protect plant give world clean save environment pollute nature resource water',
  48:'',
  49:'phone internet message send screen call use computer connect talk电',
  50:'computer find look watch read show learn study information machine electronic technology',
  51:'book story interesting page end tell read write word author picture magazine newspaper',
  52:'save spend enough need want wait money buy cost poor rich value',
  53:'enough choose new happy love price money pay buy save gift',
  54:'',
  55:'news happen hear report city people true today tell story event press announce public',
  56:'world country people language different same place nation foreign culture border population race',
  57:'problem important change poor danger together help save war peace hunger crisis suffer refugee aid army weapon soldier attack fight kill destroy defend military government official leader',
  58:'agree opinion reason maybe sure think because right wrong believe idea argue discuss decide judge',
  59:'grow dream hope future job become want plan work succeed goal build college',
  60:'forget remember always best write letter hope future wish',
}
const KW = {}
for (const n of Object.keys(K)) KW[n] = new Set(K[n].split(/\s+/).filter(Boolean))


// ── maturity gate: adult/news subject matter must not land in a young child's
// daily-life lesson. Such words are restricted to the closing units (49-60),
// where the blueprint deliberately concentrates VOA's news vocabulary.
const ADULT_RE = /\b(war|army|military|soldier|weapon|bomb|attack|kill|murder|crime|criminal|court|law|legal|judge|jail|prison|govern|government|president|politic|election|vote|senate|congress|official|nation|economy|economic|money market|bank|business|trade|company|industry|labor|union|tax|budget|invest|disease|cancer|drug|medical|patient|virus|infect|sex|religio|church|god|priest|race|slave|exile|betray|revolt|riot|protest|terror|hostage|refugee|treaty|ambassador|diplomat|nuclear|missile|satellite|chemical|atom|research|scientist|technolog|percent|rate|report|press|news|agreement|policy|organization|committee|agency|billion|million)\b/
const MATURE = [37,38,39,40,41,43,44,45,46,47,49,50,51,52,53,55,56,57,58,59]
const isAdult = (e) => ADULT_RE.test(e.def) || ADULT_RE.test(e.w)

// ── assign ───────────────────────────────────────────────────────────────────
const assigned = new Map() // word -> lesson n
for (const [n, ws] of anchors) for (const w of ws) if (!assigned.has(w)) assigned.set(w, n)

const score = (e, n) => {
  const kw = KW[n]; if (!kw || kw.size === 0) return 0
  if (isAdult(e) && !MATURE.includes(n)) return -1  // gated out of children's lessons
  let s = 0
  if (kw.has(e.w)) s += 10
  for (const t of e.def.split(/[^a-z]+/)) if (t.length > 2 && kw.has(t)) s += 1
  return s
}
const TEACH = [...Array(60).keys()].map((i) => i + 1).filter((n) => !SYNTH.has(n))
const unassigned = []
for (const e of ALL) {
  if (incidentalSet.has(e.w) || assigned.has(e.w)) continue
  let best = 0, bestN = null
  const cands = isAdult(e) ? MATURE : TEACH
  for (const n of cands) { const s = score(e, n); if (s > best) { best = s; bestN = n } }
  if (bestN) assigned.set(e.w, bestN); else unassigned.push(e.w)
}

// ── rebalance into budget ────────────────────────────────────────────────────
const budget = (n) => (SYNTH.has(n) ? { min: 0, max: 10 } : { min: 20, max: 25 })
const buckets = new Map([...Array(60).keys()].map((i) => [i + 1, []]))
for (const [w, n] of assigned) buckets.get(n).push(w)

// overflow -> pool
const pool = [...unassigned]
for (const n of [...buckets.keys()]) {
  const { max } = budget(n)
  const b = buckets.get(n)
  // keep anchors and best-scoring first
  const anc = new Set(anchors.get(n) ?? [])
  b.sort((a, c) => (anc.has(c) ? 1 : 0) - (anc.has(a) ? 1 : 0) || score(BY.get(c), n) - score(BY.get(a), n))
  while (b.length > max) pool.push(b.pop())
}
// fill under-min lessons from pool, preferring best fit
const order = TEACH.slice()
for (const n of order) {
  const { min } = budget(n)
  const b = buckets.get(n)
  while (b.length < min && pool.length) {
    let bi = -1, bs = -1
    for (let i = 0; i < pool.length; i++) {
      const e = BY.get(pool[i]); if (isAdult(e) && !MATURE.includes(n)) continue
      const s = score(e, n); if (s > bs) { bs = s; bi = i }
    }
    if (bi < 0) break
    b.push(pool.splice(bi, 1)[0])
  }
}
// remaining pool -> spread to lessons with room (teaching first, then synthesis)
for (const n of [...TEACH, ...SYNTH]) {
  const { max } = budget(n)
  const b = buckets.get(n)
  while (b.length < max && pool.length) {
    let bi = -1, bs = -1
    for (let i = 0; i < pool.length; i++) {
      const e = BY.get(pool[i]); if (isAdult(e) && !MATURE.includes(n)) continue
      const s = score(e, n); if (s > bs) { bs = s; bi = i }
    }
    if (bi < 0) break
    b.push(pool.splice(bi, 1)[0])
  }
}
// still leftover -> incidental (function-ish remainder rides along in prose)
for (const w of pool) incidentalSet.add(w)

// ── incidental home lessons ──────────────────────────────────────────────────
const incidental = {}
{
  let i = 0
  for (const w of [...incidentalSet].sort()) { incidental[w] = (i % 12) + 1; i++ }
}

// ── review plan: two later 综合 lessons (fallback: later teaching lessons) ────
const review = {}
for (const [n, ws] of buckets) {
  const later = [...Array(60).keys()].map((i) => i + 1).filter((x) => x > n)
  const synthLater = later.filter((x) => SYNTH.has(x))
  const picks = [...synthLater.slice(0, 2)]
  while (picks.length < 2 && later.length) {
    const cand = later[Math.min(later.length - 1, picks.length * 7 + 3)]
    if (cand && !picks.includes(cand)) picks.push(cand); else break
  }
  for (const w of ws) review[w] = picks
}

const lessons = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([n, targets]) => ({ n, targets: targets.sort() }))
writeFileSync(`${root}/.agents/skills/sr-voa1500/allocation.json`,
  JSON.stringify({ lessons, incidental, review }, null, 1))

const sizes = lessons.map((l) => l.targets.length)
console.log('targets total:', sizes.reduce((a, b) => a + b, 0), '| incidental:', Object.keys(incidental).length)
console.log('teaching min/max:', Math.min(...lessons.filter((l) => !SYNTH.has(l.n)).map((l) => l.targets.length)),
  Math.max(...lessons.filter((l) => !SYNTH.has(l.n)).map((l) => l.targets.length)))
console.log('synth max:', Math.max(...lessons.filter((l) => SYNTH.has(l.n)).map((l) => l.targets.length)))
