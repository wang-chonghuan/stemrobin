#!/usr/bin/env node
// sr-math-lesson — build-time figure generator (STEMROBIN-50). A deterministic
// declarative-spec -> static inline SVG renderer. Authors write a semantic spec
// (a circle, points on it by angle, a central angle, a labeled arc / a number
// line with an open endpoint); this computes correct coordinates and emits a
// self-contained <svg> using the three-hue DESIGN palette. No runtime JS: the
// output is static SVG that renders in the lesson HTML and the print PDF.
//
// Why a spec (not hand-drawn SVG): geometry figures put points ON a circle, mark
// EQUAL angles, draw the MINOR arc — all coordinate math a human gets wrong at
// scale. The spec makes those correct-by-construction and machine-checkable.
//
// Usage (module): import { renderFigure } from './figure.mjs'; renderFigure(spec)
// Usage (CLI):    node figure.mjs spec.json > fig.svg   (or --self for a demo)

// ---- DESIGN palette (resources/reference/DESIGN.md — three hues + ink scale) ----
const C = {
  blue: '#0E7C9B', blueDeep: '#0A5E76', blueTint: '#E1F1F5',
  green: '#15A06A', greenDeep: '#0F7D52',
  ink: '#15201F', inkSoft: '#4C5A58', inkDim: '#8A9795', line: '#E3EAE9',
}
const num = (v) => (Math.round(v * 100) / 100)               // stable 2-dp coords (determinism + clean output)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------------------------------------------------------------- geometry ----
// Point resolution: {name:{at:[x,y]}} explicit, or {on:<circleId>, angle:deg}
// (standard math convention: 0°=east, CCW positive; SVG y is down so we negate).
function resolveGeometry(spec) {
  const circles = {}
  for (const c of spec.circles || []) circles[c.id || 'c'] = c
  const P = {}
  const put = (name, x, y) => { P[name] = [num(x), num(y)] }
  // explicit points first
  for (const p of spec.points || []) if (p.at) put(p.name, p.at[0], p.at[1])
  // resolve circle centers that reference a named point, and on-circle points
  for (const c of spec.circles || []) {
    const ctr = Array.isArray(c.center) ? c.center : P[c.center]
    if (!ctr) throw new Error(`circle ${c.id}: center "${c.center}" unresolved`)
    c._c = [num(ctr[0]), num(ctr[1])]
  }
  for (const p of spec.points || []) {
    if (p.at) continue
    if (p.on != null && p.angle != null) {
      const c = circles[p.on]; if (!c) throw new Error(`point ${p.name}: circle "${p.on}" not found`)
      const t = (p.angle * Math.PI) / 180
      put(p.name, c._c[0] + c.r * Math.cos(t), c._c[1] - c.r * Math.sin(t))
    }
  }
  return { P, circles }
}

function pt(P, ref) { // ref is a point name or [x,y]
  if (Array.isArray(ref)) return [num(ref[0]), num(ref[1])]
  if (!P[ref]) throw new Error(`unknown point "${ref}"`)
  return P[ref]
}

const SEG_STYLE = {
  radius: { stroke: C.blue, w: 2 },
  chord: { stroke: C.blue, w: 2 },
  diameter: { stroke: C.blue, w: 2 },
  plain: { stroke: C.blue, w: 2 },
  emph: { stroke: C.blueDeep, w: 4 },
}

function labelPos(anchor, pos) { // small offset for a text label around a point
  const d = 15
  const map = { above: [0, -d], below: [0, d + 4], left: [-d, 4], right: [d, 4],
    'above-right': [d - 3, -d + 6], 'above-left': [-d, -d + 6], 'below-right': [d - 3, d], 'below-left': [-d, d] }
  const off = map[pos] || map.right
  return [num(anchor[0] + off[0]), num(anchor[1] + off[1])]
}

function angleAt(P, vertex, from, to, o = {}) {
  const V = pt(P, vertex), A = pt(P, from), B = pt(P, to)
  const aFrom = Math.atan2(-(A[1] - V[1]), A[0] - V[0])
  const aTo = Math.atan2(-(B[1] - V[1]), B[0] - V[0])
  // draw the SMALL angle between the rays
  let d = aTo - aFrom
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  const r = o.r || 26
  if (o.mark === 'right') { // right-angle square
    const u = [Math.cos(aFrom), -Math.sin(aFrom)], w = [Math.cos(aTo), -Math.sin(aTo)]
    const s = 16
    const p1 = [V[0] + u[0] * s, V[1] + u[1] * s]
    const p3 = [V[0] + w[0] * s, V[1] + w[1] * s]
    const p2 = [p1[0] + w[0] * s, p1[1] + w[1] * s]
    return `<polyline points="${num(p1[0])},${num(p1[1])} ${num(p2[0])},${num(p2[1])} ${num(p3[0])},${num(p3[1])}" fill="none" stroke="${C.inkSoft}" stroke-width="1.6"/>`
  }
  const start = [V[0] + r * Math.cos(aFrom), V[1] - r * Math.sin(aFrom)]
  const end = [V[0] + r * Math.cos(aTo), V[1] - r * Math.sin(aTo)]
  const sweep = d > 0 ? 0 : 1 // SVG sweep (y-down): 0 = CCW in math terms
  const largeArc = 0
  let out = `<path d="M ${num(start[0])} ${num(start[1])} A ${r} ${r} 0 ${largeArc} ${sweep} ${num(end[0])} ${num(end[1])}" fill="none" stroke="${o.color || C.green}" stroke-width="2"/>`
  if (o.label) {
    const mid = (aFrom + aTo) / 2 + (Math.abs(d) > Math.PI ? Math.PI : 0)
    const lr = r + 14
    out += text(V[0] + lr * Math.cos(mid), V[1] - lr * Math.sin(mid), o.label, { anchor: 'middle', color: o.color || C.greenDeep })
  }
  return out
}

function arcOnCircle(P, circles, a) {
  const c = circles[a.circle]; if (!c) throw new Error(`arc: circle "${a.circle}" not found`)
  const A = pt(P, a.from), B = pt(P, a.to)
  const angA = Math.atan2(-(A[1] - c._c[1]), A[0] - c._c[0])
  const angB = Math.atan2(-(B[1] - c._c[1]), B[0] - c._c[0])
  let d = angB - angA
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI // d in (-180,180] = the minor sweep A->B
  const wantMajor = a.dir === 'major'
  const large = wantMajor ? 1 : 0
  // minor arc follows the short sweep d; major goes the other way
  const sweep = (d < 0) === wantMajor ? 1 : 0
  const style = a.style === 'bold'
    ? { stroke: C.blueDeep, w: 5 } : { stroke: C.green, w: 4 }
  let out = `<path d="M ${A[0]} ${A[1]} A ${c.r} ${c.r} 0 ${large} ${sweep} ${B[0]} ${B[1]}" fill="none" stroke="${style.stroke}" stroke-width="${style.w}"/>`
  if (a.label) {
    const midAng = wantMajor ? (angA + angB) / 2 + Math.PI : (angA + angB) / 2
    const lr = c.r + 20
    out += text(c._c[0] + lr * Math.cos(midAng), c._c[1] - lr * Math.sin(midAng), a.label, { anchor: 'middle', color: style.stroke })
  }
  return out
}

function tickMarks(P, t) { // equal-length hash marks at the midpoints of segments
  const n = t.count || 1
  let out = ''
  for (const seg of t.segments || []) {
    const A = pt(P, seg[0]), B = pt(P, seg[1])
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len // along
    const nx = -uy, ny = ux // normal
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 6
      const cx = mid[0] + ux * off, cy = mid[1] + uy * off
      out += `<line x1="${num(cx - nx * 5)}" y1="${num(cy - ny * 5)}" x2="${num(cx + nx * 5)}" y2="${num(cy + ny * 5)}" stroke="${C.green}" stroke-width="1.8"/>`
    }
  }
  return out
}

function text(x, y, s, o = {}) {
  return `<text x="${num(x)}" y="${num(y)}" font-size="${o.size || 15}" font-weight="${o.weight || 700}" fill="${o.color || C.inkSoft}" text-anchor="${o.anchor || 'start'}">${esc(s)}</text>`
}

function renderGeometry(spec) {
  const { P, circles } = resolveGeometry(spec)
  const parts = []
  for (const c of spec.circles || []) parts.push(`<circle cx="${c._c[0]}" cy="${c._c[1]}" r="${c.r}" fill="none" stroke="${C.blue}" stroke-width="2.5"/>`)
  for (const a of spec.arcs || []) parts.push(arcOnCircle(P, circles, a)) // arcs under segments/points
  for (const s of spec.segments || []) {
    const A = pt(P, s.from), B = pt(P, s.to), st = SEG_STYLE[s.kind] || SEG_STYLE.plain
    parts.push(`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${st.stroke}" stroke-width="${st.w}"/>`)
  }
  for (const a of spec.angles || []) parts.push(angleAt(P, a.vertex, a.from, a.to, a))
  for (const t of spec.ticks || []) parts.push(tickMarks(P, t))
  for (const [name, xy] of Object.entries(P)) {
    const p = (spec.points || []).find((q) => q.name === name) || {}
    if (p.hidden) continue
    const isCenter = (spec.circles || []).some((c) => c.center === name)
    parts.push(`<circle cx="${xy[0]}" cy="${xy[1]}" r="${isCenter ? 4.5 : 4}" fill="${isCenter ? C.blue : C.blueDeep}"/>`)
    const labelText = p.label != null ? p.label : name
    if (labelText !== '') { const l = labelPos(xy, p.labelPos || 'right'); parts.push(text(l[0], l[1], labelText, { color: C.ink, size: 14 })) }
  }
  for (const l of spec.labels || []) { const at = pt(P, l.at); const lp = labelPos(at, l.pos || 'right'); parts.push(text(lp[0], lp[1], l.text, { color: C.inkSoft, size: 14, anchor: l.anchor })) }
  return parts.join('\n  ')
}

// -------------------------------------------------------------- number line ----
function renderNumberLine(spec) {
  const [w, h] = spec.size || [560, 120]
  const [lo, hi] = spec.range
  const padX = 40, y0 = spec.axisY || Math.round(h * 0.55)
  const X = (v) => num(padX + ((v - lo) / (hi - lo)) * (w - 2 * padX))
  const parts = [`<line x1="${X(lo) - 12}" y1="${y0}" x2="${X(hi) + 12}" y2="${y0}" stroke="${C.ink}" stroke-width="2"/>`,
    `<polygon points="${X(hi) + 12},${y0} ${X(hi) + 4},${y0 - 5} ${X(hi) + 4},${y0 + 5}" fill="${C.ink}"/>`]
  for (const t of spec.ticks || []) { parts.push(`<line x1="${X(t)}" y1="${y0 - 5}" x2="${X(t)}" y2="${y0 + 5}" stroke="${C.inkSoft}" stroke-width="1.5"/>`); parts.push(text(X(t), y0 + 22, String(t), { anchor: 'middle', color: C.inkSoft, size: 13, weight: 500 })) }
  for (const r of spec.rays || []) {
    const from = X(r.from), dir = r.dir === 'left' ? -1 : 1
    const to = dir > 0 ? X(hi) + 4 : X(lo) - 4
    parts.push(`<line x1="${from}" y1="${y0}" x2="${to}" y2="${y0}" stroke="${C.blue}" stroke-width="5"/>`)
  }
  for (const p of spec.points || []) {
    const open = p.fill === 'open'
    parts.push(`<circle cx="${X(p.x)}" cy="${y0}" r="6" fill="${open ? '#FFFFFF' : C.blueDeep}" stroke="${C.blueDeep}" stroke-width="2.2"/>`)
    if (p.label != null) parts.push(text(X(p.x), y0 - 14, String(p.label), { anchor: 'middle', color: C.blueDeep, size: 14 }))
  }
  return parts.join('\n  ')
}

// ------------------------------------------------------------------- render ----
export function renderFigure(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('figure spec must be an object')
  const [w, h] = spec.size || (spec.kind === 'numberline' ? [560, 120] : [600, 440])
  const aria = spec.aria || spec.caption || (spec.kind === 'numberline' ? '数轴' : '几何图')
  let body
  if (spec.kind === 'numberline') body = renderNumberLine(spec)
  else if (spec.kind === 'geometry') body = renderGeometry(spec)
  else throw new Error(`unknown figure kind "${spec.kind}" (geometry|numberline)`)
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">\n  ${body}\n</svg>`
}

// Validate a spec without rendering (used by check-content/check-exercises).
export function validateFigure(spec, tag = 'figure') {
  const problems = []
  try { renderFigure(spec) } catch (e) { problems.push(`${tag}: ${e.message}`) }
  return problems
}

// The learner-referenceable labels a figure carries (point names/labels, angle
// and arc labels, number-line point labels). Used for the figure-text
// consistency check: a figure whose labels never appear in the surrounding prose
// is disconnected from the text — a sign the figure is decorative, not load-bearing.
export function figureLabels(spec) {
  const out = new Set()
  const add = (v) => { if (v != null && String(v).trim()) out.add(String(v).trim()) }
  for (const p of spec.points || []) { if (!p.hidden) { add(p.name); add(p.label) } }
  for (const a of spec.angles || []) add(a.label)
  for (const a of spec.arcs || []) add(a.label)
  for (const s of spec.segments || []) add(s.label)
  for (const l of spec.labels || []) add(l.text)
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  if (arg === '--self') { // built-in demo specs, for a quick eyeball
    const circle = { kind: 'geometry', size: [600, 440], aria: 'demo circle',
      circles: [{ id: 'c1', center: 'O', r: 150 }],
      points: [{ name: 'O', at: [300, 220] }, { name: 'A', on: 'c1', angle: 60, labelPos: 'above-right' }, { name: 'B', on: 'c1', angle: 150, labelPos: 'above-left' }],
      segments: [{ from: 'O', to: 'A', kind: 'radius' }, { from: 'O', to: 'B', kind: 'radius' }, { from: 'A', to: 'B', kind: 'chord', }],
      angles: [{ vertex: 'O', from: 'A', to: 'B', label: 'α' }],
      arcs: [{ circle: 'c1', from: 'A', to: 'B', dir: 'minor', label: '弧AB', style: 'bold' }],
      ticks: [{ segments: [['O', 'A'], ['O', 'B']], count: 1 }] }
    const nl = { kind: 'numberline', range: [-2, 6], ticks: [-2, -1, 0, 1, 2, 3, 4, 5, 6], rays: [{ from: 3, dir: 'right' }], points: [{ x: 3, fill: 'open', label: '3' }] }
    process.stdout.write(renderFigure(circle) + '\n\n' + renderFigure(nl) + '\n')
  } else if (arg) {
    const { readFileSync } = await import('node:fs')
    process.stdout.write(renderFigure(JSON.parse(readFileSync(arg, 'utf8'))) + '\n')
  } else { console.error('usage: figure.mjs <spec.json> | --self'); process.exit(2) }
}
