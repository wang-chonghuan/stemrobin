// The hero's static star map: a hand-laid constellation echoing the landing
// design — the LemmaDeck mark at the centre, math concepts on the LEFT arc
// (gold) and physics on the RIGHT arc (blue), wrapped in orbit ellipses.
//
// It renders inside an invisible card to the right of the hero copy (normal
// layout flow, no visible surface), and animates without any JS: SMIL drives
// glowing particles along every spoke and a slow twinkle on nodes and dust.
// Decorative only: pointer-events are disabled by the wrapper.

import type { Locale } from '~/lib/i18n'

// Two skins: `dark` is the space landing; `light` is tuned to a Seneca-style
// white UI (violet math / bright blue physics, slate labels, lavender lines).
export type StarmapVariant = 'dark' | 'light'
const PALETTE = {
  dark: {
    math: '#ffc46b',
    phys: '#7dd0ff',
    line: '#a8d4ff',
    lineOpacity: 0.28,
    crossOpacity: 0.14,
    orbit: '#8fd8ff',
    orbitOpacity: 0.13,
    dust: '#cfe6ff',
    label: 'rgba(233,241,255,0.95)',
    coreStops: ['#e8fbff', '#7de8e0'],
    coreOpacity: [0.95, 0.45],
    coreFill: '#f4fbff',
    coreStroke: 'none',
  },
  light: {
    math: '#f08c1a',
    phys: '#4a7df7',
    line: '#8794d6',
    lineOpacity: 0.35,
    crossOpacity: 0.2,
    orbit: '#7c8ce0',
    orbitOpacity: 0.22,
    dust: '#93a8e0',
    label: '#3d4566',
    coreStops: ['#dbe7ff', '#4a7df7'],
    coreOpacity: [0.9, 0.18],
    coreFill: '#ffffff',
    coreStroke: '#dfe6fa',
  },
} as const

type Node = {
  x: number
  y: number
  d: 'math' | 'phys'
  side: 'l' | 'r' | 'c'
  en: string
  zh: string
}

// Math occupies the left half, physics the right half (user ruling).
const NODES: Node[] = [
  { x: 318, y: 100, d: 'math', side: 'c', en: 'Decimals & Percentages', zh: '小数与百分数' },
  { x: 232, y: 172, d: 'math', side: 'l', en: 'Vectors', zh: '向量' },
  { x: 194, y: 252, d: 'math', side: 'l', en: 'Progressions', zh: '等差与等比数列' },
  { x: 202, y: 332, d: 'math', side: 'l', en: 'Systems of Equations', zh: '方程组' },
  { x: 240, y: 406, d: 'math', side: 'l', en: 'Intro to Functions', zh: '函数初步' },
  { x: 334, y: 466, d: 'math', side: 'l', en: 'Trigonometric Functions', zh: '三角函数' },
  { x: 618, y: 96, d: 'phys', side: 'c', en: 'Oscillations & AC', zh: '振动与交流' },
  { x: 702, y: 168, d: 'phys', side: 'r', en: 'Wave Optics & Spectra', zh: '光的波动与光谱' },
  { x: 748, y: 248, d: 'phys', side: 'r', en: 'Electric Fields & Capacitance', zh: '电场与电容' },
  { x: 752, y: 330, d: 'phys', side: 'r', en: 'Nucleus & Particles', zh: '原子核与粒子' },
  { x: 714, y: 404, d: 'phys', side: 'r', en: 'Force & Motion', zh: '力与运动' },
  { x: 604, y: 466, d: 'phys', side: 'c', en: 'Pressure & Buoyancy', zh: '压强与浮力' },
]

// Fixed pseudo-random dust so SSR and client render identically.
const DUST = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453
  const b = Math.sin(i * 311.7) * 12543.8567
  return {
    x: 50 + (a - Math.floor(a)) * 840,
    y: 30 + (b - Math.floor(b)) * 510,
    r: 0.7 + ((i * 7) % 10) / 11,
    o: 0.25 + ((i * 13) % 10) / 18,
  }
})

const CX = 470
const CY = 288

// Long labels break at the ampersand so they wrap like the design's two-liners.
function labelLines(text: string): string[] {
  if (text.length <= 16 || !text.includes(' & ')) return [text]
  const [a, b] = text.split(' & ')
  return [`${a} &`, b]
}

export function LandingStarmap({
  locale,
  variant = 'dark',
}: {
  locale: Locale
  variant?: StarmapVariant
}) {
  const P = PALETTE[variant]
  const coreId = `ld-core-${variant}`
  const softId = `ld-soft-${variant}`
  const color = (d: 'math' | 'phys') => (d === 'math' ? P.math : P.phys)
  return (
    <svg
      className={`ld-starmap ${variant}`}
      viewBox="0 0 940 590"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={P.coreStops[0]} stopOpacity={P.coreOpacity[0]} />
          <stop offset="40%" stopColor={P.coreStops[1]} stopOpacity={P.coreOpacity[1]} />
          <stop offset="100%" stopColor={P.coreStops[1]} stopOpacity="0" />
        </radialGradient>
        <filter id={softId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {/* orbit arcs */}
      <g fill="none" stroke={P.orbit} strokeOpacity={P.orbitOpacity}>
        <ellipse cx={CX} cy={CY} rx="300" ry="150" transform={`rotate(-14 ${CX} ${CY})`} />
        <ellipse cx={CX} cy={CY} rx="238" ry="196" transform={`rotate(11 ${CX} ${CY})`} />
        <ellipse cx={CX} cy={CY} rx="345" ry="118" transform={`rotate(-27 ${CX} ${CY})`} strokeOpacity={P.orbitOpacity * 0.7} />
      </g>

      {/* dust, a third of it twinkling */}
      <g fill={P.dust}>
        {DUST.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o}>
            {i % 3 === 0 && (
              <animate
                attributeName="opacity"
                values={`${s.o};${Math.min(1, s.o + 0.45)};${s.o}`}
                dur={`${2.6 + (i % 5) * 0.7}s`}
                begin={`${(i % 7) * 0.5}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        ))}
      </g>

      {/* spokes */}
      <g stroke={P.line} strokeOpacity={P.lineOpacity} strokeWidth="1">
        {NODES.map((n) => (
          <line key={n.en} x1={CX} y1={CY} x2={n.x} y2={n.y} />
        ))}
      </g>
      {/* a few cross links between neighbouring concepts */}
      <g stroke={P.line} strokeOpacity={P.crossOpacity} strokeWidth="1" fill="none">
        <path d={`M${NODES[1].x} ${NODES[1].y} Q ${CX - 60} ${CY - 190} ${NODES[7].x} ${NODES[7].y}`} />
        <path d={`M${NODES[5].x} ${NODES[5].y} Q ${CX} ${CY + 230} ${NODES[10].x} ${NODES[10].y}`} />
        <path d={`M${NODES[2].x} ${NODES[2].y} Q ${CX - 250} ${CY + 70} ${NODES[4].x} ${NODES[4].y}`} />
      </g>

      {/* particles: one glowing mote per spoke, radiating from the core */}
      <g>
        {NODES.map((n, i) => {
          const dur = 3.6 + (i % 5) * 0.9
          const begin = (i * 0.62) % 4
          return (
            <circle key={n.en} r="1.8" fill={color(n.d)} opacity="0">
              <animateMotion
                path={`M${CX} ${CY} L${n.x} ${n.y}`}
                dur={`${dur}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                keyTimes="0;0.15;0.75;1"
                dur={`${dur}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
            </circle>
          )
        })}
      </g>

      {/* concept nodes + labels */}
      {NODES.map((n, i) => {
        const lines = labelLines(locale === 'zh' ? n.zh : n.en)
        const anchor = n.side === 'l' ? 'end' : n.side === 'r' ? 'start' : 'middle'
        const lx = n.side === 'l' ? n.x - 12 : n.side === 'r' ? n.x + 12 : n.x
        const ly0 =
          n.side === 'c'
            ? n.y < CY
              ? n.y - 14 - (lines.length - 1) * 16
              : n.y + 22
            : n.y - (lines.length - 1) * 7 + 4
        return (
          <g key={n.en}>
            <circle cx={n.x} cy={n.y} r="8" fill={color(n.d)} opacity="0.28" filter={`url(#${softId})`}>
              <animate
                attributeName="opacity"
                values="0.28;0.55;0.28"
                dur={`${3 + (i % 4) * 0.8}s`}
                begin={`${(i % 6) * 0.45}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle cx={n.x} cy={n.y} r="3.4" fill={color(n.d)} />
            <text
              x={lx}
              y={ly0}
              textAnchor={anchor}
              fontSize="14.5"
              fill={P.label}
              style={{ letterSpacing: '0.02em' }}
            >
              {lines.map((line, li) => (
                <tspan key={line} x={lx} dy={li === 0 ? 0 : 16}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}

      {/* core */}
      <circle cx={CX} cy={CY} r="64" fill={`url(#${coreId})`}>
        <animate attributeName="r" values="64;72;64" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle cx={CX} cy={CY} r="27" fill={P.coreFill} stroke={P.coreStroke} strokeWidth="1.5" />
      <image href="/logo-mark-96.png" x={CX - 17} y={CY - 17} width="34" height="34" />
    </svg>
  )
}
