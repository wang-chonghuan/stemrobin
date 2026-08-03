import { useMemo, useState } from 'react'

import { t, type Locale } from '~/lib/i18n'
import type { ExerciseGridSpec } from '~/lib/lessons'

// A coordinate exercise answered by clicking. The learner places one marker per
// named point; each placement writes that point's x and y into the two blanks
// the spec says they belong to, so the server grades exactly what it graded
// before — a click is just a faster way of filling two numbers.
//
// The component never receives the answer. It knows the grid, the names to
// place, and which blank each click feeds. Standard positions arrive only after
// grading, from the result.

const CELL = 30
const PAD = 26

type Placed = Record<string, { x: number; y: number }>

export function GridAnswerField({
  grid,
  locale,
  locked,
  standard,
  onValues,
}: {
  grid: ExerciseGridSpec
  locale: Locale
  locked: boolean
  // 判完之后每个小问的标准值，按小问顺序；未判完时为空。
  standard?: (string | undefined)[]
  onValues: (index: number, value: string) => void
}) {
  const [placed, setPlaced] = useState<Placed>({})
  const [active, setActive] = useState(0)

  const [x0, x1] = grid.domain.x
  const [y0, y1] = grid.domain.y
  const width = (x1 - x0) * CELL + PAD * 2
  const height = (y1 - y0) * CELL + PAD * 2
  const sx = (x: number) => PAD + (x - x0) * CELL
  const sy = (y: number) => height - PAD - (y - y0) * CELL

  const target = grid.points[active]

  // 标准位置：把按小问顺序给的标准值折回成每个点的坐标。
  const standardPoints = useMemo(() => {
    if (!standard || standard.some((value) => value == null)) return null
    const out: Placed = {}
    grid.parts.forEach((part, index) => {
      const value = Number(standard[index])
      if (!Number.isFinite(value)) return
      const point = out[part.point] ?? { x: 0, y: 0 }
      point[part.axis] = value
      out[part.point] = point
    })
    return out
  }, [grid.parts, standard])

  function place(x: number, y: number) {
    if (locked || !target) return
    const next = { ...placed, [target]: { x, y } }
    setPlaced(next)
    grid.parts.forEach((part, index) => {
      const point = next[part.point]
      if (point) onValues(index, String(point[part.axis]))
    })
    const remaining = grid.points.findIndex((name) => !next[name])
    setActive(remaining === -1 ? active : remaining)
  }

  const cells = []
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      cells.push(
        <rect
          key={`${x},${y}`}
          className="sr-grid-hit"
          x={sx(x) - CELL / 2}
          y={sy(y) - CELL / 2}
          width={CELL}
          height={CELL}
          onClick={() => place(x, y)}
        />,
      )
    }
  }

  return (
    <div className="sr-grid-answer">
      <div className="sr-grid-prompt">
        {grid.points.map((name, index) => (
          <button
            key={name}
            type="button"
            className={
              'sr-grid-chip' +
              (placed[name] ? ' done' : '') +
              (index === active && !locked ? ' on' : '')
            }
            disabled={locked}
            onClick={() => setActive(index)}
          >
            {name}
            {placed[name] && (
              <span className="sr-num">
                ({placed[name].x}, {placed[name].y})
              </span>
            )}
          </button>
        ))}
      </div>

      <svg
        className="sr-grid-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t(locale, 'exercise.grid.aria')}
      >
        {Array.from({ length: x1 - x0 + 1 }, (_, i) => (
          <line key={`v${i}`} className="sr-grid-line" x1={sx(x0 + i)} y1={sy(y0)} x2={sx(x0 + i)} y2={sy(y1)} />
        ))}
        {Array.from({ length: y1 - y0 + 1 }, (_, i) => (
          <line key={`h${i}`} className="sr-grid-line" x1={sx(x0)} y1={sy(y0 + i)} x2={sx(x1)} y2={sy(y0 + i)} />
        ))}
        <line className="sr-grid-axis" x1={sx(x0)} y1={sy(0)} x2={sx(x1)} y2={sy(0)} />
        <line className="sr-grid-axis" x1={sx(0)} y1={sy(y0)} x2={sx(0)} y2={sy(y1)} />
        {Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i).map((x) =>
          x === 0 ? null : (
            <text key={`tx${x}`} className="sr-grid-tick" x={sx(x)} y={sy(0) + 15} textAnchor="middle">
              {x}
            </text>
          ),
        )}
        {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((y) =>
          y === 0 ? null : (
            <text key={`ty${y}`} className="sr-grid-tick" x={sx(0) - 7} y={sy(y) + 4} textAnchor="end">
              {y}
            </text>
          ),
        )}
        {!locked && cells}
        {standardPoints &&
          Object.entries(standardPoints).map(([name, point]) => (
            <g key={`s${name}`} className="sr-grid-standard">
              <circle cx={sx(point.x)} cy={sy(point.y)} r={7} />
              <text x={sx(point.x) + 11} y={sy(point.y) - 8}>{name}</text>
            </g>
          ))}
        {Object.entries(placed).map(([name, point]) => (
          <g key={`p${name}`} className="sr-grid-placed">
            <circle cx={sx(point.x)} cy={sy(point.y)} r={5} />
            <text x={sx(point.x) + 9} y={sy(point.y) + 16}>{name}</text>
          </g>
        ))}
      </svg>

      {standardPoints && (
        <p className="sr-grid-legend">{t(locale, 'exercise.grid.legend')}</p>
      )}
    </div>
  )
}
