#!/usr/bin/env node
// sr-math-lesson (JSONB-first) — deterministic renderer. Turns the neutral
// card-tree `content` + exercise `exercises` JSONB + the per-locale prose
// `overlay` into the self-contained lesson HTML (and, via renderPdf, a print
// PDF). HTML/PDF are DERIVED caches of the JSONB SSOT.
//
// Answer-key secrecy (G5): this renderer NEVER reads item.key. The learner-
// visible read-check + practice projections carry prompts + options only. The
// answer KEY (correct_index / accept / answer) is structurally never emitted.
//
// Prose (card bodies, read-check + exercise prompts/options) is resolved from
// the overlay by node id; formulas (KaTeX) and SVG are neutral and inline in
// `content`. The per-card section display name (中文名, `card.name`) is a
// required field of the neutral `content` base and is rendered from there.
// Header chrome derives from the ledger metadata
// (`meta`), which is the zh source and not part of the learner i18n overlay.
//
// Usage (standalone render, prints HTML to stdout):
//   node render-lesson.mjs --content c.json --exercises e.json --overlay o.json --meta m.json
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderFigure } from './figure.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = join(scriptDir, '..', 'assets', 'lesson-template.html')

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function optionLabel(index) {
  let n = index, label = ''
  do { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return label
}

// Resolve translated prose for a node id from the overlay. Fail fast on a
// missing id so a shape bug surfaces instead of rendering a silent blank.
function txt(overlay, id, ctx) {
  const entry = overlay[id]
  if (!entry || typeof entry.t !== 'string') throw new Error(`overlay missing prose for node id "${id}" (${ctx})`)
  return entry.t
}

function renderBodyNode(node, overlay, cardId) {
  if (node.kind === 'formula') return `    <p class="sr-formula">$$${node.tex}$$</p>`
  if (node.kind === 'svg') {
    // A figure is either a `spec` (declarative → figure.mjs computes coordinates)
    // or raw `svg` markup (legacy / bespoke). Prefer the spec — it is
    // correct-by-construction and machine-checkable.
    const svg = node.spec ? renderFigure(node.spec) : node.svg
    const cap = node.caption_id ? `<figcaption>${esc(txt(overlay, node.caption_id, `svg caption in ${cardId}`))}</figcaption>` : ''
    return `    <figure class="sr-fig">${svg}${cap}</figure>`
  }
  // prose
  const t = txt(overlay, node.id, `body prose in ${cardId}`)
  if (node.role === 'html') return t   // verbatim neutral block markup (migration: preserves original block structure)
  if (node.role === 'note') return `    <div class="sr-note">${t}</div>`
  if (node.role === 'pitfall') return `    <div class="sr-pitfall">${t}</div>`
  if (node.role === 'h3') return `    <h3>${esc(t)}</h3>`
  return `    <p>${t}</p>`
}

// Prompts + options ONLY (never the key). Shared by read-check + practice.
function renderChoiceOptions(item, overlay, ctx) {
  if (item.mode !== 'choice' || !Array.isArray(item.options)) return ''
  const opts = item.options
    .map((optId, k) => `<span class="sr-p-opt"><b>${optionLabel(k)}.</b> ${esc(txt(overlay, optId, `${ctx} option`))}</span>`)
    .join('')
  return `<div class="sr-p-opts">${opts}</div>`
}

function renderReadCheck(card, overlay) {
  if (!Array.isArray(card.read_check) || !card.read_check.length) return ''
  const items = card.read_check.map((rc) => {
    const prompt = esc(txt(overlay, rc.id, `read-check ${rc.id}`))
    return `      <li>${prompt}${renderChoiceOptions(rc, overlay, `read-check ${rc.id}`)}</li>`
  }).join('\n')
  return `
    <div class="sr-readcheck">
      <div class="sr-rc-label">读一读 · 检查</div>
      <ol class="sr-practice">
${items}
      </ol>
    </div>`
}

function renderCard(card, overlay) {
  // Section display name (中文名) is a required per-card field in the content JSONB
  // (the SSOT); fail fast if a card reaches the renderer without one.
  if (typeof card.name !== 'string' || !card.name.trim())
    throw new Error(`card "${card.id || card.anchor}" is missing its section name (中文名)`)
  const name = card.name
  const body = (card.body || []).map((n) => renderBodyNode(n, overlay, card.id)).join('\n')
  return `  <section data-sr-section="${card.anchor}">
    <div class="sr-sec-label"><span class="sr-sec-num">${card.num}</span><span class="sr-sec-name">${esc(name)}</span></div>
${body}${renderReadCheck(card, overlay)}
  </section>`
}

// Consolidated practice section rendered from the exercises deck (prompts +
// options only), mirroring the historical deck-injected practice projection.
function renderPractice(exercises, overlay, secCount) {
  const items = (exercises?.items || []).slice().sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
  if (!items.length) return ''
  const lis = items.map((q) => {
    const tags = `<span class="sr-ptype">${esc(q.type)}</span>` +
      (q.layer === '复习' ? `<span class="sr-ptype" style="background:var(--sr-green-tint);color:var(--sr-green-deep)">复习</span>` : '')
    const prompt = esc(txt(overlay, q.id, `exercise ${q.id}`))
    return `      <li>${tags} ${prompt}${renderChoiceOptions(q, overlay, `exercise ${q.id}`)}</li>`
  }).join('\n')
  return `
  <section data-sr-section="practice">
    <div class="sr-sec-label"><span class="sr-sec-num">${secCount + 1}</span><span class="sr-sec-name">练习</span></div>
    <p class="sr-p-note">做完打开「卡片答题」逐题核对——答案和讲解都在那里。</p>
    <ol class="sr-practice">
${lis}
    </ol>
  </section>`
}

// content + exercises + overlay + meta → self-contained lesson HTML.
export function renderLessonHtml({ meta, content, exercises, overlay }) {
  if (!content || !Array.isArray(content.cards)) throw new Error('content.cards missing')
  const template = readFileSync(TEMPLATE_PATH, 'utf8')
  const title = `${meta.stage}.${meta.order} ${meta.title}`
  const eyebrow = meta.eyebrow || `数学 · ${meta.theme || ''} · ${meta.genre}`
  const concept = meta.concept || ''
  const chips = `<span class="sr-chip">${esc(meta.genre)}</span>`

  const cards = content.cards.slice().sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
  const sections = cards.map((c) => renderCard(c, overlay)).join('\n\n')
  const practice = renderPractice(exercises, overlay, cards.length)

  const readcheckStyle = `
  <style>
    /* JSONB-first read-check projection (self-contained) */
    .sr-readcheck { margin-top:14px; border-top:1px dashed var(--sr-line); padding-top:10px; }
    .sr-rc-label { font:700 11px var(--sr-mono); color:var(--sr-green-deep); text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
    ol.sr-practice { padding-left:0; list-style:none; counter-reset:p; }
    ol.sr-practice > li { counter-increment:p; position:relative; padding:9px 0 9px 34px; border-top:1px solid var(--sr-line-soft); font-size:14.5px; }
    ol.sr-practice > li:first-child { border-top:0; }
    ol.sr-practice > li::before { content:counter(p); position:absolute; left:0; top:9px; width:22px; height:22px; display:grid; place-items:center; border-radius:6px; background:var(--sr-panel); color:var(--sr-ink-soft); font-family:var(--sr-mono); font-size:11.5px; font-weight:600; }
    .sr-ptype { display:inline-block; margin-right:6px; border-radius:5px; padding:0 6px; background:var(--sr-blue-tint); color:var(--sr-blue-deep); font-size:10.5px; font-weight:700; vertical-align:1px; }
    .sr-p-note { color: var(--sr-ink-dim); font-size: 12.5px; margin: -2px 0 8px; }
    .sr-p-opts { display:flex; flex-wrap:wrap; gap:4px 18px; margin-top:7px; }
    .sr-p-opt { font-size:14px; }
    .sr-p-opt b { font-family:var(--sr-mono); font-weight:600; color:var(--sr-ink-soft); margin-right:3px; }
    @media print { section[data-sr-section="practice"] { break-before: page; page-break-before: always; } ol.sr-practice > li { border-top:1.4px solid #111; border-bottom:1.4px solid #111; padding:16px 0 46px; break-inside:avoid; } ol.sr-practice > li::before { top:16px; } }
  </style>`

  // Function replacements: a string second arg to String.replace interprets $&,
  // $$, $` etc. in the replacement — and esc() turns `>`/`<` into `&gt;`/`&lt;`,
  // so a prompt like `$>$` becomes `$&gt;` whose `$&` would inject the matched
  // placeholder ({{SECTIONS}}). A function replacement is taken verbatim.
  return template
    .replace(/\{\{TITLE\}\}/g, () => esc(title))
    .replace('{{EYEBROW}}', () => esc(eyebrow))
    .replace('{{CONCEPT}}', () => esc(concept))
    .replace('{{CHIPS}}', () => chips)
    .replace('{{SECTIONS}}', () => `${sections}\n${practice}`)
    .replace('</head>', () => `${readcheckStyle}\n</head>`)
}

// Render the print PDF for a full lesson html (best effort — playwright-core).
export async function renderPdf(html) {
  try {
    const { chromium } = await import('playwright-core')
    let browser
    try { browser = await chromium.launch() } catch { browser = await chromium.launch({ channel: 'chrome' }) }
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.katex && document.querySelectorAll('.katex').length > 0, null, { timeout: 6000 }).catch(() => {})
      await page.evaluate(() => document.fonts.ready.then(() => true))
      await page.waitForTimeout(400)
      await page.emulateMedia({ media: 'print' })
      const buf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
      console.error(`✓ pdf rendered (${Math.round(buf.length / 1024)} KB)`)
      return buf
    } finally { await browser.close() }
  } catch (e) {
    console.error(`! PDF not generated (${(e && e.message) || e})`)
    return null
  }
}

// CLI: render to stdout from JSON files.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
  const rd = (p, what) => { try { return JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8')) } catch (e) { console.error(`✗ ${what} JSON: ${e.message}`); process.exit(1) } }
  if (!args.content || !args.overlay || !args.meta) { console.error('usage: render-lesson.mjs --content c.json --exercises e.json --overlay o.json --meta m.json'); process.exit(2) }
  const html = renderLessonHtml({
    meta: rd(args.meta, 'meta'),
    content: rd(args.content, 'content'),
    exercises: args.exercises ? rd(args.exercises, 'exercises') : { items: [] },
    overlay: rd(args.overlay, 'overlay'),
  })
  process.stdout.write(html)
}
