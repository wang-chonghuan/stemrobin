#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const skillDir = path.dirname(scriptDir)
const skillsDir = path.dirname(skillDir)
const validator = path.join(scriptDir, 'validate_spec.py')
const jsxgraphPath = path.join(
  skillsDir,
  'node_modules',
  'jsxgraph',
  'distrib',
  'jsxgraphcore.js',
)
const jsxgraphCssPath = path.join(
  skillsDir,
  'node_modules',
  'jsxgraph',
  'distrib',
  'jsxgraph.css',
)

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (!key.startsWith('--')) {
      throw new Error(`unexpected argument: ${key}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for ${key}`)
    }
    result[key.slice(2)] = value
    index += 1
  }
  if (!result.spec || (!result.svg && !result.png)) {
    throw new Error(
      'usage: render_spec.mjs --spec spec.json [--svg out.svg] ' +
      '[--png out.png] [--report render.json]',
    )
  }
  return result
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true })
}

function validateSpec(specPath) {
  const result = spawnSync(
    process.env.PYTHON || 'python3',
    [validator, specPath, '--stage', 'draft', '--json'],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    const detail = result.stdout.trim() || result.stderr.trim()
    throw new Error(`FigureSpec validation failed:\n${detail}`)
  }
}

function imageMime(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  throw new Error(`unsupported artwork format: ${filePath}`)
}

function embedAssets(spec) {
  const assets = new Map()
  for (const asset of spec.assets || []) {
    const assetPath = path.isAbsolute(asset.path)
      ? asset.path
      : path.resolve(asset.path)
    if (!fs.existsSync(assetPath)) {
      throw new Error(`missing artwork asset: ${assetPath}`)
    }
    const data = fs.readFileSync(assetPath).toString('base64')
    assets.set(asset.id, {
      ...asset,
      dataUri: `data:${imageMime(assetPath)};base64,${data}`,
    })
  }
  return {
    ...spec,
    assets: [...assets.values()],
    objects: spec.objects.map((object) => (
      object.type === 'image'
        ? { ...object, dataUri: assets.get(object.asset)?.dataUri }
        : object
    )),
  }
}

function portablePath(filePath) {
  const absolute = path.resolve(filePath)
  const relative = path.relative(process.cwd(), absolute)
  return relative.startsWith('..') ? absolute : relative || '.'
}

function chromeExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  const executable = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executable) {
    throw new Error(
      'Chrome/Chromium not found; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
    )
  }
  return executable
}

async function render(spec, output) {
  const browser = await chromium.launch({
    executablePath: chromeExecutable(),
    headless: true,
  })
  try {
    const page = await browser.newPage({
      viewport: {
        width: spec.canvas.width,
        height: spec.canvas.height,
      },
      deviceScaleFactor: 1,
    })
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
            #board {
              width: ${spec.canvas.width}px;
              height: ${spec.canvas.height}px;
              background: ${spec.canvas.background || '#ffffff'};
              border: 0;
            }
          </style>
        </head>
        <body><div id="board" class="jxgbox"></div></body>
      </html>
    `)
    await page.addStyleTag({ path: jsxgraphCssPath })
    await page.addScriptTag({ path: jsxgraphPath })

    const result = await page.evaluate((figureSpec) => {
      const SVG_NS = 'http://www.w3.org/2000/svg'
      const palette = {
        primary: '#0f8b8d',
        secondary: '#58a942',
        ink: '#172526',
        grid: '#9acfd0',
        muted: '#657475',
        ...figureSpec.palette,
      }
      const box = figureSpec.canvas.boundingBox
      const board = JXG.JSXGraph.initBoard('board', {
        boundingbox: box,
        axis: false,
        grid: false,
        keepaspectratio: figureSpec.canvas.keepAspectRatio !== false,
        pan: { enabled: false },
        zoom: { enabled: false },
        showNavigation: false,
        showCopyright: false,
        renderer: 'svg',
      })
      board.suspendUpdate()

      const elements = new Map()
      const definitions = new Map(
        figureSpec.objects.map((object) => [object.id, object]),
      )
      const labels = []
      const visiblePoints = []
      const imageRegions = []
      const rawPaths = []

      const pointValue = (value) => {
        if (Array.isArray(value)) return value
        const definition = definitions.get(value)
        if (definition?.type === 'point') return definition.at
        throw new Error(`unresolved point: ${String(value)}`)
      }
      const jsxPoint = (value) => {
        if (typeof value === 'string' && elements.has(value)) {
          return elements.get(value)
        }
        return pointValue(value)
      }
      const color = (value, fallback) => palette[value] || value || fallback
      const lineStyle = (object, fallback = palette.ink) => ({
        fixed: true,
        highlight: false,
        strokeColor: color(object.stroke, fallback),
        strokeWidth: object.strokeWidth || 3,
        dash: object.dash || 0,
        opacity: object.opacity ?? 1,
      })
      const addLabel = (object, at, text = object.label) => {
        if (!text) return
        labels.push({
          id: `${object.id}-label`,
          at: pointValue(at),
          text,
          placement: object.labelPlacement || {},
          fontSize: object.fontSize || 28,
          fontWeight: object.fontWeight || 600,
          fill: color(object.labelColor, palette.ink),
          textAnchor: object.textAnchor,
          dominantBaseline: object.dominantBaseline || 'middle',
        })
      }
      const createSegment = (id, from, to, style) => {
        const segment = board.create('segment', [jsxPoint(from), jsxPoint(to)], {
          id: `ld-${id}`,
          ...style,
        })
        elements.set(id, segment)
        return segment
      }

      for (const object of figureSpec.objects) {
        if (object.type === 'point') {
          const point = board.create('point', object.at, {
            id: `ld-${object.id}`,
            name: '',
            withLabel: false,
            fixed: true,
            highlight: false,
            visible: object.visible !== false,
            face: object.face || 'o',
            size: object.size || 4,
            strokeWidth: object.strokeWidth || 2,
            strokeColor: color(object.stroke, palette.primary),
            fillColor: color(object.fill, palette.primary),
          })
          elements.set(object.id, point)
          if (object.visible !== false) {
            visiblePoints.push({ at: object.at, radius: (object.size || 4) + 5 })
          }
          addLabel(object, object.at)
        } else if (object.type === 'segment') {
          createSegment(
            object.id,
            object.from,
            object.to,
            lineStyle(object),
          )
          addLabel(object, [
            (pointValue(object.from)[0] + pointValue(object.to)[0]) / 2,
            (pointValue(object.from)[1] + pointValue(object.to)[1]) / 2,
          ])
        } else if (object.type === 'line') {
          const line = board.create('line', [
            jsxPoint(object.from),
            jsxPoint(object.to),
          ], {
            id: `ld-${object.id}`,
            straightFirst: true,
            straightLast: true,
            ...lineStyle(object),
          })
          elements.set(object.id, line)
        } else if (object.type === 'arrow') {
          const arrow = board.create('arrow', [
            jsxPoint(object.from),
            jsxPoint(object.to),
          ], {
            id: `ld-${object.id}`,
            ...lineStyle(object, palette.primary),
          })
          elements.set(object.id, arrow)
        } else if (object.type === 'circle') {
          const circle = board.create('circle', [
            jsxPoint(object.center),
            object.radius,
          ], {
            id: `ld-${object.id}`,
            fixed: true,
            highlight: false,
            strokeColor: color(object.stroke, palette.primary),
            strokeWidth: object.strokeWidth || 3,
            fillColor: color(object.fill, 'none'),
            fillOpacity: object.fillOpacity ?? 0,
          })
          elements.set(object.id, circle)
        } else if (object.type === 'polygon') {
          const polygon = board.create(
            'polygon',
            object.points.map(jsxPoint),
            {
              id: `ld-${object.id}`,
              fixed: true,
              highlight: false,
              fillColor: color(object.fill, palette.secondary),
              fillOpacity: object.fillOpacity ?? 0.15,
              vertices: { visible: false },
              borders: lineStyle(object),
            },
          )
          elements.set(object.id, polygon)
        } else if (object.type === 'arc') {
          const arc = board.create('arc', [
            jsxPoint(object.center),
            jsxPoint(object.start),
            jsxPoint(object.end),
          ], {
            id: `ld-${object.id}`,
            ...lineStyle(object, palette.primary),
          })
          elements.set(object.id, arc)
        } else if (object.type === 'grid') {
          const [xMin, yMax, xMax, yMin] = object.bounds || box
          let index = 0
          for (
            let x = Math.ceil(xMin / object.xStep) * object.xStep;
            x <= xMax + 1e-9 && index < 500;
            x += object.xStep
          ) {
            createSegment(
              `${object.id}-v-${index}`,
              [x, yMin],
              [x, yMax],
              lineStyle(object, palette.grid),
            )
            index += 1
          }
          index = 0
          for (
            let y = Math.ceil(yMin / object.yStep) * object.yStep;
            y <= yMax + 1e-9 && index < 500;
            y += object.yStep
          ) {
            createSegment(
              `${object.id}-h-${index}`,
              [xMin, y],
              [xMax, y],
              lineStyle(object, palette.grid),
            )
            index += 1
          }
        } else if (object.type === 'axis') {
          createSegment(
            object.id,
            object.from,
            object.to,
            lineStyle(object, palette.ink),
          )
          const start = pointValue(object.from)
          const end = pointValue(object.to)
          const dx = end[0] - start[0]
          const dy = end[1] - start[1]
          const length = Math.hypot(dx, dy) || 1
          const normal = [-dy / length, dx / length]
          for (const [index, tick] of (object.ticks || []).entries()) {
            const at = Array.isArray(tick.at)
              ? tick.at
              : [start[0] + dx * tick.at, start[1] + dy * tick.at]
            const size = tick.size || object.tickSize || 0.12
            createSegment(
              `${object.id}-tick-${index}`,
              [at[0] - normal[0] * size, at[1] - normal[1] * size],
              [at[0] + normal[0] * size, at[1] + normal[1] * size],
              lineStyle(object, palette.ink),
            )
            if (tick.label !== undefined) {
              addLabel(
                {
                  id: `${object.id}-tick-${index}`,
                  labelPlacement: tick.labelPlacement || {
                    position: Math.abs(dx) >= Math.abs(dy) ? 'S' : 'E',
                  },
                  fontSize: tick.fontSize || object.fontSize || 26,
                  fontWeight: 600,
                  labelColor: object.labelColor,
                },
                at,
                String(tick.label),
              )
            }
          }
        } else if (object.type === 'measure') {
          const start = pointValue(object.from)
          const end = pointValue(object.to)
          createSegment(
            object.id,
            start,
            end,
            lineStyle(object, palette.primary),
          )
          const dx = end[0] - start[0]
          const dy = end[1] - start[1]
          const length = Math.hypot(dx, dy) || 1
          const normal = [-dy / length, dx / length]
          const size = object.capSize || 0.15
          for (const [index, at] of [start, end].entries()) {
            createSegment(
              `${object.id}-cap-${index}`,
              [at[0] - normal[0] * size, at[1] - normal[1] * size],
              [at[0] + normal[0] * size, at[1] + normal[1] * size],
              lineStyle(object, palette.primary),
            )
          }
          addLabel(object, [
            (start[0] + end[0]) / 2,
            (start[1] + end[1]) / 2,
          ])
        } else if (object.type === 'text') {
          addLabel(object, object.at, object.text)
        } else if (object.type === 'image') {
          if (!object.dataUri) throw new Error(`missing asset: ${object.asset}`)
          const image = board.create('image', [
            object.dataUri,
            object.at,
            object.size,
          ], {
            id: `ld-${object.id}`,
            fixed: true,
            highlight: false,
            opacity: object.opacity ?? 1,
          })
          if (object.rotation) {
            const center = board.create('point', object.rotation.center, {
              name: '',
              visible: false,
              fixed: true,
            })
            const transform = board.create('transform', [
              object.rotation.angleDegrees * Math.PI / 180,
              center,
            ], {
              type: 'rotate',
            })
            transform.bindTo(image)
          }
          elements.set(object.id, image)
          if (object.avoidLabels === true) {
            imageRegions.push([
              object.at[0],
              object.at[1] + object.size[1],
              object.at[0] + object.size[0],
              object.at[1],
            ])
          }
        } else if (object.type === 'svgPath') {
          rawPaths.push(object)
        }
      }

      board.unsuspendUpdate()
      board.fullUpdate()

      const svg = document.querySelector('#board svg')
      if (!svg) throw new Error('JSXGraph did not create an SVG renderer')
      svg.setAttribute('xmlns', SVG_NS)
      svg.setAttribute('width', String(figureSpec.canvas.width))
      svg.setAttribute('height', String(figureSpec.canvas.height))
      svg.setAttribute(
        'viewBox',
        `0 0 ${figureSpec.canvas.width} ${figureSpec.canvas.height}`,
      )
      svg.style.background = figureSpec.canvas.background || '#ffffff'

      const imageFits = figureSpec.objects
        .filter((object) => object.type === 'image')
        .map((object) => {
          const node = document.getElementById(`board_ld-${object.id}`)
          if (!node) {
            return {
              id: object.id,
              status: 'fail',
              reason: 'missing rendered image node',
            }
          }
          // JSXGraph defaults SVG images to preserveAspectRatio="none".
          // Treat FigureSpec size as a fit box and never distort artwork.
          node.setAttribute('preserveAspectRatio', 'xMidYMid meet')
          return {
            id: object.id,
            status: node.getAttribute('preserveAspectRatio') === 'xMidYMid meet'
              ? 'pass'
              : 'fail',
            preserveAspectRatio: node.getAttribute('preserveAspectRatio'),
          }
        })

      if (rawPaths.length) {
        const rawLayer = document.createElementNS(SVG_NS, 'g')
        rawLayer.setAttribute('id', 'ld-raw-path-layer')
        const scaleX = figureSpec.canvas.width / (
          figureSpec.canvas.boundingBox[2] - figureSpec.canvas.boundingBox[0]
        )
        const scaleY = figureSpec.canvas.height / (
          figureSpec.canvas.boundingBox[1] - figureSpec.canvas.boundingBox[3]
        )
        rawLayer.setAttribute('transform', `scale(${scaleX} ${scaleY})`)
        for (const object of rawPaths) {
          const node = document.createElementNS(SVG_NS, 'path')
          node.setAttribute('d', object.d)
          node.setAttribute('fill', color(object.fill, 'none'))
          node.setAttribute('stroke', color(object.stroke, 'none'))
          node.setAttribute(
            'stroke-width',
            String((object.strokeWidth || 1) / Math.max(scaleX, scaleY)),
          )
          if (object.fillOpacity !== undefined) {
            node.setAttribute('fill-opacity', String(object.fillOpacity))
          }
          if (object.strokeOpacity !== undefined) {
            node.setAttribute('stroke-opacity', String(object.strokeOpacity))
          }
          rawLayer.appendChild(node)
        }
        svg.appendChild(rawLayer)
      }

      const toScreen = (at) => {
        const coords = new JXG.Coords(JXG.COORDS_BY_USER, at, board)
        return [coords.scrCoords[1], coords.scrCoords[2]]
      }
      const rectFromRegion = (region) => {
        const topLeft = toScreen([region[0], region[1]])
        const bottomRight = toScreen([region[2], region[3]])
        return {
          x: Math.min(topLeft[0], bottomRight[0]),
          y: Math.min(topLeft[1], bottomRight[1]),
          width: Math.abs(bottomRight[0] - topLeft[0]),
          height: Math.abs(bottomRight[1] - topLeft[1]),
        }
      }
      const labelLayer = document.createElementNS(SVG_NS, 'g')
      labelLayer.setAttribute('id', 'ld-label-layer')
      svg.appendChild(labelLayer)
      const geometryNodes = [...svg.querySelectorAll(
        'line, path, polygon, polyline, circle, ellipse, rect',
      )].filter((node) => (
        !node.closest('defs') &&
        node.getAttribute('display') !== 'none' &&
        node.getAttribute('stroke') !== 'none' &&
        Number.parseFloat(node.getAttribute('stroke-width') || '0') > 2.5
      ))

      const minGap = figureSpec.layout?.minLabelGap ?? 4
      const avoid = [
        ...visiblePoints.map((point) => {
          const [x, y] = toScreen(point.at)
          return {
            x: x - point.radius,
            y: y - point.radius,
            width: point.radius * 2,
            height: point.radius * 2,
          }
        }),
        ...imageRegions.map(rectFromRegion),
        ...(figureSpec.layout?.avoidRegions || []).map(rectFromRegion),
      ]
      const occupied = []
      const collisions = []

      const overlapArea = (a, b) => {
        const width = Math.max(
          0,
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
        )
        const height = Math.max(
          0,
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
        )
        return width * height
      }
      const inflate = (rect, amount) => ({
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2,
        height: rect.height + amount * 2,
      })
      const outsideArea = (rect) => {
        const clippedWidth = Math.max(
          0,
          Math.min(rect.x + rect.width, figureSpec.canvas.width) -
            Math.max(rect.x, 0),
        )
        const clippedHeight = Math.max(
          0,
          Math.min(rect.y + rect.height, figureSpec.canvas.height) -
            Math.max(rect.y, 0),
        )
        return rect.width * rect.height - clippedWidth * clippedHeight
      }
      const strokeHitsRect = (node, rect) => {
        if (typeof node.getTotalLength !== 'function') return false
        let length
        try {
          length = node.getTotalLength()
        } catch {
          return false
        }
        if (!Number.isFinite(length) || length <= 0) return false
        const ctm = node.getCTM()
        const samples = Math.min(500, Math.max(2, Math.ceil(length / 4)))
        for (let index = 0; index <= samples; index += 1) {
          const point = node.getPointAtLength(length * index / samples)
          const transformed = ctm
            ? new DOMPoint(point.x, point.y).matrixTransform(ctm)
            : point
          if (
            transformed.x >= rect.x &&
            transformed.x <= rect.x + rect.width &&
            transformed.y >= rect.y &&
            transformed.y <= rect.y + rect.height
          ) {
            return true
          }
        }
        return false
      }
      const placements = {
        CENTER: [0, 0, 'middle'],
        NE: [1, -1, 'start'],
        NW: [-1, -1, 'end'],
        SE: [1, 1, 'start'],
        SW: [-1, 1, 'end'],
        E: [1, 0, 'start'],
        W: [-1, 0, 'end'],
        N: [0, -1, 'middle'],
        S: [0, 1, 'middle'],
      }

      for (const label of labels) {
        const node = document.createElementNS(SVG_NS, 'text')
        node.textContent = label.text
        node.setAttribute('fill', label.fill)
        node.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
        node.setAttribute('font-size', String(label.fontSize))
        node.setAttribute('font-weight', String(label.fontWeight))
        node.setAttribute('dominant-baseline', label.dominantBaseline)
        node.setAttribute('data-label-id', label.id)
        labelLayer.appendChild(node)

        const [anchorX, anchorY] = toScreen(label.at)
        const gap = label.placement.gap ?? Math.max(10, label.fontSize * 0.45)
        const offset = label.placement.offset || [0, 0]
        const requested = label.placement.position
        const automatic = ['NE', 'NW', 'SE', 'SW', 'E', 'W', 'N', 'S']
        const candidates = requested
          ? (
              label.placement.fallback
                ? [requested, ...automatic.filter((item) => item !== requested)]
                : [requested]
            )
          : automatic
        let best = null

        for (const position of candidates) {
          const [xDirection, yDirection, anchor] =
            placements[position] || placements.NE
          node.setAttribute(
            'x',
            String(anchorX + xDirection * gap + offset[0]),
          )
          node.setAttribute(
            'y',
            String(anchorY + yDirection * gap + offset[1]),
          )
          node.setAttribute('text-anchor', label.textAnchor || anchor)
          const rect = node.getBBox()
          const padded = inflate(rect, minGap)
          const overlap = [...avoid, ...occupied].reduce(
            (sum, other) => sum + overlapArea(padded, other),
            0,
          )
          const strokeCollision = geometryNodes.some(
            (geometry) => strokeHitsRect(geometry, padded),
          )
          const score =
            overlap +
            outsideArea(padded) * 100 +
            (strokeCollision ? 10000 : 0)
          if (!best || score < best.score) {
            best = {
              position,
              x: node.getAttribute('x'),
              y: node.getAttribute('y'),
              anchor: label.textAnchor || anchor,
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              score,
            }
          }
        }

        node.setAttribute('x', best.x)
        node.setAttribute('y', best.y)
        node.setAttribute('text-anchor', best.anchor)
        occupied.push(inflate(best.rect, minGap))
        if (best.score > 0.5) {
          collisions.push({
            id: label.id,
            text: label.text,
            position: best.position,
            score: best.score,
          })
        }
      }

      svg.querySelectorAll('foreignObject, script').forEach((node) => node.remove())
      return {
        svg: svg.outerHTML,
        labels: labels.length,
        collisions,
        objects: figureSpec.objects.length,
        imageFits,
      }
    }, spec)

    if (output.svg) {
      ensureParent(output.svg)
      fs.writeFileSync(output.svg, `${result.svg}\n`, 'utf8')
    }
    if (output.png) {
      ensureParent(output.png)
      await page.locator('#board').screenshot({
        path: output.png,
        type: 'png',
        animations: 'disabled',
      })
    }
    return result
  } finally {
    await browser.close()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const specPath = path.resolve(args.spec)
  validateSpec(specPath)
  const rawSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
  if (rawSpec.mode === 'generated') {
    throw new Error('generated mode must be produced with n-azure cap4')
  }
  const spec = embedAssets(rawSpec)
  const result = await render(spec, {
    svg: args.svg && path.resolve(args.svg),
    png: args.png && path.resolve(args.png),
  })
  const report = {
    schema: 'ld-s10y-image/render@1',
    figure: spec.id,
    mode: spec.mode,
    renderer: {
      name: 'JSXGraph',
      version: JSON.parse(
        fs.readFileSync(
          path.join(skillsDir, 'node_modules', 'jsxgraph', 'package.json'),
          'utf8',
        ),
      ).version,
    },
    spec: {
      path: portablePath(specPath),
      sha256: sha256File(specPath),
    },
    output: {
      ...(args.svg
        ? { svg: { path: portablePath(args.svg), sha256: sha256File(args.svg) } }
        : {}),
      ...(args.png
        ? { png: { path: portablePath(args.png), sha256: sha256File(args.png) } }
        : {}),
    },
    objects: result.objects,
    labels: result.labels,
    collisions: result.collisions,
    imageFits: result.imageFits,
    status: (
      result.collisions.length ||
      result.imageFits.some((item) => item.status !== 'pass')
    ) ? 'fail' : 'pass',
  }
  if (args.report) {
    ensureParent(args.report)
    fs.writeFileSync(
      args.report,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    )
  }
  if (report.status === 'fail') {
    console.error(JSON.stringify(report, null, 2))
    process.exitCode = 2
  } else {
    console.log(`PASS: ${spec.id} (${result.objects} objects, ${result.labels} labels)`)
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
})
