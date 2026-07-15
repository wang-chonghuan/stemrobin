// sr-math-lesson — STEMROBIN-21 migration library (PURE, no DB).
// Turns an existing lesson's stored HTML + its sr_questions deck into the
// neutral JSONB SSOT (content card-tree + exercises deck) plus the zh prose
// overlay, WITHOUT re-authoring prose. Structural extraction only:
//   - teaching <section data-sr-section> → cards (the deck-injected `practice`
//     section is EXCLUDED); card anchors must equal the genre anchor set.
//   - <figure><svg> → neutral `svg` body node (SVG shared cross-locale; the
//     <figcaption> becomes overlay prose via caption_id).
//   - every other top-level block → a prose body node rendered VERBATIM
//     (role 'html'); its markup+text live in the zh overlay.
//   - sr_questions rows → exercises items; prompt/options → overlay; the answer
//     KEY (correct_index/accept) stays in item.key (neutral base), never overlay.
// Answer-key secrecy: no builder here ever writes correct_index/accept/answer
// into an overlay entry.
import { ANCHORS, SUBSTANTIAL } from './check-content.mjs'

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'col', 'source', 'area', 'wbr'])

// Split an element's inner HTML into its top-level child elements (and any
// non-whitespace stray text). Depth-counts by the SAME tag name so nested
// different/like tags are handled; <figure>/<svg> internals are captured whole.
// Returns [{ type:'element'|'text', tag, html }].
export function splitSectionChildren(inner) {
  const out = []
  let i = 0
  const n = inner.length
  while (i < n) {
    // stray text up to the next '<'
    if (inner[i] !== '<') {
      let j = i
      while (j < n && inner[j] !== '<') j++
      const text = inner.slice(i, j)
      if (text.trim()) out.push({ type: 'text', tag: null, html: text })
      i = j
      continue
    }
    // comment
    if (inner.startsWith('<!--', i)) {
      const end = inner.indexOf('-->', i)
      i = end === -1 ? n : end + 3
      continue
    }
    // opening tag
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(inner.slice(i))
    if (!nameMatch) { i++; continue }
    const name = nameMatch[1].toLowerCase()
    const openEnd = inner.indexOf('>', i)
    if (openEnd === -1) { break }
    const openTag = inner.slice(i, openEnd + 1)
    if (VOID.has(name) || openTag.endsWith('/>')) {
      out.push({ type: 'element', tag: name, html: openTag })
      i = openEnd + 1
      continue
    }
    // find matching close by depth over <name ...> / </name>
    const end = findElementEnd(inner, openEnd + 1, name)
    out.push({ type: 'element', tag: name, html: inner.slice(i, end) })
    i = end
  }
  return out
}

// Given position just after an opening <name> tag (depth 1), return the index
// just past the matching </name>.
function findElementEnd(s, from, name) {
  const openRe = new RegExp(`<${name}(?=[\\s/>])`, 'gi')
  const closeRe = new RegExp(`</${name}\\s*>`, 'gi')
  let depth = 1
  let k = from
  while (k < s.length) {
    openRe.lastIndex = k
    closeRe.lastIndex = k
    const om = openRe.exec(s)
    const cm = closeRe.exec(s)
    if (!cm) return s.length // unbalanced — take the rest
    if (om && om.index < cm.index) { depth++; k = om.index + 1; continue }
    depth--
    k = cm.index + cm[0].length
    if (depth === 0) return k
  }
  return s.length
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Extract one teaching section's inner HTML (sr-sec-label stripped). Returns
// null when the section is absent.
export function extractSectionInner(bodyHtml, anchor) {
  const re = new RegExp(`<section data-sr-section="${anchor}">([\\s\\S]*?)</section>`)
  const m = bodyHtml.match(re)
  if (!m) return null
  return m[1].replace(/<div class="sr-sec-label">[\s\S]*?<\/div>\s*/, '')
}

// Extract the <svg…>…</svg> markup and the <figcaption> inner HTML from a figure.
function parseFigure(figureHtml) {
  const svgStart = figureHtml.indexOf('<svg')
  const svgEnd = figureHtml.lastIndexOf('</svg>')
  const svg = svgStart !== -1 && svgEnd !== -1 ? figureHtml.slice(svgStart, svgEnd + 6) : null
  const capM = figureHtml.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)
  const caption = capM ? capM[1].trim() : null
  return { svg, caption }
}

// html → { cards, overlay }. Throws on a structural violation (anchor mismatch,
// empty section) so a bad lesson fails fast instead of writing partial data.
export function htmlToCards({ html, genre, id }) {
  const anchors = ANCHORS[genre]
  if (!anchors) throw new Error(`unknown genre ${genre} for ${id}`)
  const bodyHtml = html.slice(Math.max(0, html.indexOf('<body')))
  const overlay = {}
  const cards = []
  anchors.forEach((anchor, ci) => {
    const inner = extractSectionInner(bodyHtml, anchor)
    if (inner == null) throw new Error(`${id}: teaching section "${anchor}" (genre ${genre}) not found`)
    const cardId = `${id}-${anchor}`
    const body = []
    const children = splitSectionChildren(inner)
    children.forEach((child, j) => {
      if (child.type === 'element' && child.tag === 'figure' && /<svg[\s>]/i.test(child.html)) {
        const { svg, caption } = parseFigure(child.html)
        const node = { kind: 'svg', svg: svg || child.html }
        if (caption) { const capId = `${cardId}-cap${j}`; node.caption_id = capId; overlay[capId] = { t: caption, src_rev: 1 } }
        body.push(node)
      } else {
        const bId = `${cardId}-b${j}`
        overlay[bId] = { t: child.html.trim(), src_rev: 1 }
        body.push({ kind: 'prose', role: 'html', id: bId })
      }
    })
    if (!body.length) throw new Error(`${id}: section "${anchor}" produced no body nodes`)
    cards.push({ id: cardId, num: ci + 1, anchor, rev: 1, body, read_check: [] })
  })
  return { cards, overlay }
}

// The substantial-card anchors for a genre (must carry >=2 read-checks).
export function substantialAnchors(genre) { return SUBSTANTIAL[genre] || [] }

// sr_questions rows (each {ord,type,answer_mode,options,correct_index,accept,layer,review_of,prompt})
// → { exercises:{items}, overlay }. KEY stays in item.key only.
export function deckToExercises({ rows, id }) {
  const overlay = {}
  const items = rows.slice().sort((a, b) => a.ord - b.ord).map((r) => {
    const itemId = `${id}-ex${String(r.ord).padStart(2, '0')}`
    overlay[itemId] = { t: r.prompt, src_rev: 1 }
    const item = { id: itemId, ord: r.ord, type: r.type, mode: r.answer_mode, layer: r.layer, review_of: r.review_of ?? null, rev: 1 }
    if (r.answer_mode === 'choice') {
      const optIds = (r.options || []).map((opt, k) => {
        const oid = `${itemId}-o${k}`
        overlay[oid] = { t: String(opt), src_rev: 1 }
        return oid
      })
      item.options = optIds
      item.key = { correct_index: r.correct_index }
    } else if (r.answer_mode === 'input') {
      item.key = { accept: r.accept || [] }
    } else {
      item.key = { answer: r.answer || '' }
    }
    return item
  })
  return { exercises: { items }, overlay }
}

// Merge authored read-checks (keyed by anchor) into cards + overlay. Each
// authored rc: { mode:'choice'|'input', prompt, options?:[strings], correct_index?, accept?:[strings] }.
// Produces node ids + overlay prose; KEY goes to rc.key (neutral base) only.
export function mergeReadChecks({ cards, overlay, byAnchor }) {
  for (const card of cards) {
    const authored = byAnchor[card.anchor]
    if (!authored || !authored.length) continue
    card.read_check = authored.map((a, k) => {
      const rcId = `${card.id}-rc${k}`
      overlay[rcId] = { t: a.prompt, src_rev: 1 }
      const rc = { id: rcId, mode: a.mode, rev: 1 }
      if (a.mode === 'choice') {
        rc.options = (a.options || []).map((opt, oi) => {
          const oid = `${rcId}-o${oi}`
          overlay[oid] = { t: String(opt), src_rev: 1 }
          return oid
        })
        rc.key = { correct_index: a.correct_index }
      } else {
        rc.key = { accept: a.accept || [] }
      }
      return rc
    })
  }
  return { cards, overlay }
}

export { esc }
