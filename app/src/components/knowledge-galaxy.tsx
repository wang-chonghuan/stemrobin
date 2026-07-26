// The knowledge galaxy: every topic of the shelf as a star on a 2.5D galactic
// disc, laid out by semantic embedding (see prototypes/knowledge-galaxy). The
// disc carries the information in its plane; the third dimension is only
// thickness and parallax, which is what keeps 1,100 labels legible.
//
// Three.js is loaded with a dynamic import the first time the section scrolls
// into view, so neither SSR nor the main client chunk ever sees it. Until then
// the host renders as an empty dark panel the size the canvas will take.
//
// Data comes from /galaxy.json (public/), rebuilt by
// prototypes/knowledge-galaxy/pipeline/build_galaxy.py.

import { useEffect, useRef } from 'react'
import type { Locale } from '~/lib/i18n'

// Discipline colors. Math is the house subject, so it wears the warm gold that
// carries more visual weight on the dark field; physics recedes into blue.
const COLORS: Record<string, string> = {
  math: '#ffc46b',
  physics: '#6bc8ff',
}

const STRINGS = {
  en: {
    hint: 'Drag to orbit · Right-drag to pan · Click a star to centre it · Pinch or ⌘+scroll to zoom',
    math: 'Mathematics',
    physics: 'Physics',
  },
  zh: {
    hint: '拖拽旋转 · 右键拖拽平移 · 点击星星居中 · 双指或 ⌘+滚轮缩放',
    math: '数学',
    physics: '物理',
  },
} as const

type Star = {
  id: string
  title: string
  titleEn?: string
  kind: string
  discipline: 'math' | 'physics'
  cluster: number
  x: number
  y: number
  bookTitle: string
  bookTitleEn?: string
  chapter?: string
  chapterEn?: string
}
type Hub = { cluster: number; name: string; nameEn: string; discipline: 'math' | 'physics'; size: number; x: number; y: number }
type Galaxy = { hubs: Hub[]; edges: { a: number; b: number; w: number }[]; stars: Star[] }

export function KnowledgeGalaxy({ locale }: { locale: Locale }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const localeRef = useRef(locale)
  const relabelRef = useRef<() => void>(() => {})

  localeRef.current = locale
  useEffect(() => relabelRef.current(), [locale])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let cleanup = () => {}

    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const [THREE, { OrbitControls }, galaxy] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        fetch('/galaxy.json').then((r) => r.json() as Promise<Galaxy>),
      ])
      if (disposed) return
      cleanup = build(host, THREE, OrbitControls, galaxy, localeRef, relabelRef)
    })
    io.observe(host)

    return () => {
      disposed = true
      io.disconnect()
      cleanup()
    }
  }, [])

  const s = STRINGS[locale]
  return (
    <div ref={hostRef} className="sr-galaxy">
      <div className="sr-galaxy-hint">{s.hint}</div>
      <div className="sr-galaxy-legend">
        <span>
          <i style={{ background: COLORS.math }} /> {s.math}
        </span>
        <span>
          <i style={{ background: COLORS.physics }} /> {s.physics}
        </span>
      </div>
    </div>
  )
}

// Everything below runs client-side only, after three has arrived.
function build(
  host: HTMLDivElement,
  THREE: typeof import('three'),
  OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
  data: Galaxy,
  localeRef: { current: Locale },
  relabelRef: { current: () => void },
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  renderer.domElement.className = 'sr-galaxy-canvas'
  host.appendChild(renderer.domElement)

  const labelLayer = document.createElement('div')
  labelLayer.className = 'sr-galaxy-labels'
  host.appendChild(labelLayer)

  const tooltip = document.createElement('div')
  tooltip.className = 'sr-galaxy-tooltip'
  host.appendChild(tooltip)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05070f)
  scene.fog = new THREE.Fog(0x05070f, 70, 190)

  const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 500)
  camera.position.set(0, 46, 78)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  // Pan stays in the disc plane (right-drag / two-finger drag); the target is
  // clamped each frame so nobody can pan off into the void.
  controls.enablePan = true
  controls.screenSpacePanning = false
  // Wheel zoom would trap the page's scroll, so plain wheel is left alone;
  // pinch (which browsers deliver as ctrl+wheel) and ⌘+wheel dolly instead.
  controls.enableZoom = false
  controls.minPolarAngle = 0.6
  controls.maxPolarAngle = 1.32
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.25
  let idleTimer: ReturnType<typeof setTimeout>
  controls.addEventListener('start', () => {
    controls.autoRotate = false
    clearTimeout(idleTimer)
  })
  controls.addEventListener('end', () => {
    idleTimer = setTimeout(() => (controls.autoRotate = true), 4000)
  })
  const onWheel = (ev: WheelEvent) => {
    if (!ev.ctrlKey && !ev.metaKey) return
    ev.preventDefault()
    const dir = camera.position.clone().sub(controls.target)
    const len = THREE.MathUtils.clamp(dir.length() * (ev.deltaY > 0 ? 1.08 : 0.92), 26, 130)
    camera.position.copy(controls.target).addScaledVector(dir.normalize(), len)
  }
  host.addEventListener('wheel', onWheel, { passive: false })

  // ----- geometry: UMAP xy -> disc xz, thin y ---------------------------------
  const S = 30
  let seed = 42
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

  const { stars, hubs, edges } = data
  const N = stars.length
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const size = new Float32Array(N)
  const phase = new Float32Array(N)
  const starWorld: InstanceType<typeof THREE.Vector3>[] = []
  const color = (d: string) => new THREE.Color(COLORS[d] ?? '#ffffff')

  for (let i = 0; i < N; i++) {
    const s = stars[i]
    const x = s.x * S
    const z = s.y * S
    const y = (rand() - 0.5) * 3.2
    pos.set([x, y, z], i * 3)
    starWorld.push(new THREE.Vector3(x, y, z))
    const c = color(s.discipline)
    c.offsetHSL((rand() - 0.5) * 0.05, (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.12)
    col.set([c.r, c.g, c.b], i * 3)
    size[i] = s.kind === 'section' ? 1.5 : 1.05 + rand() * 0.7
    phase[i] = rand() * Math.PI * 2
  }

  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aPhase;
      uniform float uTime, uPx;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.6 + aPhase) * 0.22;
        p.x += sin(uTime * 0.31 + aPhase * 1.7) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.75 + 0.25 * sin(uTime * 1.4 + aPhase * 3.1);
        vTw = tw;
        vColor = aColor;
        gl_PointSize = aSize * uPx * tw * 130.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vTw;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = smoothstep(0.5, 0.05, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.35;
        gl_FragColor = vec4(vColor, (core + halo) * (0.55 + 0.45 * vTw));
      }`,
  })
  const starPoints = new THREE.Points(starGeo, starMat)
  scene.add(starPoints)

  // ----- hubs -----------------------------------------------------------------
  const hubWorld = hubs.map((h) => new THREE.Vector3(h.x * S, 0, h.y * S))
  const hubGeo = new THREE.BufferGeometry()
  const hpos = new Float32Array(hubs.length * 3)
  const hcol = new Float32Array(hubs.length * 3)
  const hsize = new Float32Array(hubs.length)
  const hphase = new Float32Array(hubs.length)
  hubs.forEach((h, i) => {
    hpos.set([hubWorld[i].x, 0, hubWorld[i].z], i * 3)
    const c = color(h.discipline).offsetHSL(0, 0.05, 0.1)
    hcol.set([c.r, c.g, c.b], i * 3)
    hsize[i] = 3.2 + Math.sqrt(h.size) * 0.55
    hphase[i] = rand() * Math.PI * 2
  })
  hubGeo.setAttribute('position', new THREE.BufferAttribute(hpos, 3))
  hubGeo.setAttribute('aColor', new THREE.BufferAttribute(hcol, 3))
  hubGeo.setAttribute('aSize', new THREE.BufferAttribute(hsize, 1))
  hubGeo.setAttribute('aPhase', new THREE.BufferAttribute(hphase, 1))
  const hubMat = starMat.clone()
  scene.add(new THREE.Points(hubGeo, hubMat))

  // ----- hub-hub edges (arcs above the plane) ---------------------------------
  const edgeMeta: { line: InstanceType<typeof THREE.Line>; a: number; b: number }[] = []
  for (const e of edges) {
    const a = hubWorld[e.a]
    const b = hubWorld[e.b]
    const mid = a.clone().add(b).multiplyScalar(0.5)
    mid.y += a.distanceTo(b) * 0.22
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(28)
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    const cols = new Float32Array(pts.length * 3)
    const ca = color(hubs[e.a].discipline)
    const cb = color(hubs[e.b].discipline)
    pts.forEach((_, i) => {
      const c = ca.clone().lerp(cb, i / (pts.length - 1))
      cols.set([c.r, c.g, c.b], i * 3)
    })
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    const line = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    scene.add(line)
    edgeMeta.push({ line, a: e.a, b: e.b })
  }

  // ----- labels ---------------------------------------------------------------
  const hubLabelEls = hubs.map((h) => {
    const el = document.createElement('div')
    el.className = 'sr-galaxy-hublabel'
    el.style.fontSize = `${Math.round(11 + Math.sqrt(h.size) * 0.85)}px`
    el.style.color = `#${color(h.discipline).offsetHSL(0, 0, 0.18).getHexString()}`
    labelLayer.appendChild(el)
    return el
  })
  const STAR_LABELS = 26
  const starLabelEls = Array.from({ length: STAR_LABELS }, () => {
    const el = document.createElement('div')
    el.className = 'sr-galaxy-starlabel'
    el.style.display = 'none'
    labelLayer.appendChild(el)
    return el
  })
  const relabel = () => {
    const zh = localeRef.current === 'zh'
    hubs.forEach((h, i) => {
      hubLabelEls[i].textContent = zh ? h.name : h.nameEn
    })
  }
  relabel()
  relabelRef.current = relabel

  // ----- interaction ----------------------------------------------------------
  const raycaster = new THREE.Raycaster()
  raycaster.params.Points.threshold = 1.1
  const mouse = new THREE.Vector2(-2, -2)
  let mousePx = { x: -1e4, y: -1e4 }
  let hotHub = -1

  const onMove = (ev: PointerEvent) => {
    const r = host.getBoundingClientRect()
    mousePx = { x: ev.clientX - r.left, y: ev.clientY - r.top }
    mouse.set((mousePx.x / r.width) * 2 - 1, -(mousePx.y / r.height) * 2 + 1)
  }
  const onLeave = () => {
    mousePx = { x: -1e4, y: -1e4 }
    mouse.set(-2, -2)
  }
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerleave', onLeave)

  // Click (as opposed to drag) recentres on whatever is under the cursor: the
  // hot hub, or a raycast dust star. The camera glides over in the frame loop.
  let focusTo: InstanceType<typeof THREE.Vector3> | null = null
  let downAt = { x: 0, y: 0 }
  // Keep any camera target on the disc and inside its rim, so neither panning
  // nor click-to-centre can walk off into the void.
  const DISC_R = 80
  const clampToDisc = (v: InstanceType<typeof THREE.Vector3>) => {
    v.y = 0
    const r = Math.hypot(v.x, v.z)
    if (r > DISC_R) {
      v.x *= DISC_R / r
      v.z *= DISC_R / r
    }
    return v
  }
  const hubAtPointer = () => {
    const W = host.clientWidth
    const H = host.clientHeight
    let best = -1
    let bestD = 42 * 42
    hubWorld.forEach((p, i) => {
      proj.copy(p).project(camera)
      if (proj.z > 1) return
      const dx = (proj.x * 0.5 + 0.5) * W - mousePx.x
      const dy = (-proj.y * 0.5 + 0.5) * H - mousePx.y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }
  const onDown = (ev: PointerEvent) => {
    downAt = { x: ev.clientX, y: ev.clientY }
  }
  const onUp = (ev: PointerEvent) => {
    if (ev.button !== 0) return
    if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 6) return
    onMove(ev) // synthetic clicks may never have moved the pointer first
    const h = hubAtPointer()
    if (h >= 0) {
      focusTo = clampToDisc(hubWorld[h].clone())
      return
    }
    raycaster.setFromCamera(mouse, camera)
    const hit = raycaster.intersectObject(starPoints, false)[0]
    if (hit && (hit.distanceToRay ?? 1) < 0.9 && hit.index != null) {
      const p = starWorld[hit.index]
      focusTo = clampToDisc(new THREE.Vector3(p.x, 0, p.z))
    }
  }
  host.addEventListener('pointerdown', onDown)
  host.addEventListener('pointerup', onUp)

  const neighborsOf = (h: number) => {
    const set = new Set([h])
    for (const e of edges) {
      if (e.a === h) set.add(e.b)
      if (e.b === h) set.add(e.a)
    }
    return set
  }
  const setHotHub = (h: number) => {
    if (h === hotHub) return
    hotHub = h
    const near = h >= 0 ? neighborsOf(h) : null
    hubLabelEls.forEach((el, i) => {
      el.classList.toggle('hot', i === h)
      el.classList.toggle('dim', h >= 0 && !near!.has(i))
    })
    for (const e of edgeMeta) {
      const on = h >= 0 && (e.a === h || e.b === h)
      ;(e.line.material as InstanceType<typeof THREE.LineBasicMaterial>).opacity = on ? 0.75 : h >= 0 ? 0.03 : 0.1
    }
    host.style.cursor = h >= 0 ? 'pointer' : ''
  }

  // ----- frame loop -----------------------------------------------------------
  const proj = new THREE.Vector3()
  const clock = new THREE.Clock()
  let raf = 0
  let running = true

  const tick = () => {
    if (!running) return
    raf = requestAnimationFrame(tick)
    const t = clock.getElapsedTime()
    starMat.uniforms.uTime.value = t
    hubMat.uniforms.uTime.value = t
    controls.update()

    // glide toward a clicked star; keep the pan target on the disc and in bounds
    if (focusTo) {
      const step = focusTo.clone().sub(controls.target)
      if (step.length() < 0.05) focusTo = null
      else {
        step.multiplyScalar(0.09)
        controls.target.add(step)
        camera.position.add(step)
      }
    }
    clampToDisc(controls.target)

    const W = host.clientWidth
    const H = host.clientHeight
    const zh = localeRef.current === 'zh'

    // hub labels: big ones claim space first, and the nearest becomes hot
    const placed: { sx: number; sy: number; w: number }[] = []
    let best = -1
    let bestD = 42 * 42
    const screen = hubs.map((h, i) => {
      proj.copy(hubWorld[i]).project(camera)
      return {
        i,
        sx: (proj.x * 0.5 + 0.5) * W,
        sy: (-proj.y * 0.5 + 0.5) * H,
        visible: proj.z < 1,
        w: hubLabelEls[i].offsetWidth || (zh ? h.name.length * 13 : h.nameEn.length * 7.5),
      }
    })
    const order = [...screen].sort(
      (p, q) => Number(q.i === hotHub) - Number(p.i === hotHub) || hubs[q.i].size - hubs[p.i].size,
    )
    for (const s of order) {
      const el = hubLabelEls[s.i]
      if (!s.visible) {
        el.style.display = 'none'
        continue
      }
      const collide = placed.some(
        (p) => Math.abs(p.sy - s.sy) < 24 && Math.abs(p.sx - s.sx) < (p.w + s.w) / 2 + 10,
      )
      if (collide && s.i !== hotHub) {
        el.style.display = 'none'
        continue
      }
      placed.push(s)
      el.style.display = ''
      el.style.left = `${s.sx}px`
      el.style.top = `${s.sy}px`
      const dx = s.sx - mousePx.x
      const dy = s.sy - mousePx.y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = s.i
      }
    }
    setHotHub(best)

    // semantic zoom: topic stars near the view centre label themselves up close
    const camDist = camera.position.distanceTo(controls.target)
    const zoomT = THREE.MathUtils.clamp((62 - camDist) / 18, 0, 1)
    let li = 0
    if (zoomT > 0.05) {
      const cands: { i: number; sx: number; sy: number; d: number }[] = []
      for (let i = 0; i < N; i++) {
        proj.copy(starWorld[i]).project(camera)
        if (proj.z > 1) continue
        const sx = (proj.x * 0.5 + 0.5) * W
        const sy = (-proj.y * 0.5 + 0.5) * H
        if (sx < 40 || sx > W - 40 || sy < 36 || sy > H - 36) continue
        const dx = sx - W / 2
        const dy = sy - H / 2
        cands.push({ i, sx, sy, d: dx * dx + dy * dy })
      }
      cands.sort((a, b) => a.d - b.d)
      for (const c of cands) {
        if (li >= STAR_LABELS) break
        const s = stars[c.i]
        const title = zh ? s.title : (s.titleEn ?? s.title)
        const hub = hubs[s.cluster]
        if (hub && title.toLowerCase() === (zh ? hub.name : hub.nameEn).toLowerCase()) continue
        const w = title.length * (zh ? 11 : 6)
        const collide = placed.some(
          (p) => Math.abs(p.sy - c.sy) < 18 && Math.abs(p.sx - c.sx) < (p.w + w) / 2 + 8,
        )
        if (collide) continue
        placed.push({ sx: c.sx, sy: c.sy, w })
        const el = starLabelEls[li++]
        el.textContent = title
        el.style.display = ''
        el.style.left = `${c.sx}px`
        el.style.top = `${c.sy}px`
        el.style.opacity = (0.85 * zoomT).toFixed(2)
        el.style.color = `#${color(s.discipline).offsetHSL(0, -0.05, 0.22).getHexString()}`
      }
    }
    for (; li < STAR_LABELS; li++) starLabelEls[li].style.display = 'none'

    // tooltip for the dust, only when no hub is hot
    if (best < 0) {
      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObject(starPoints, false)[0]
      if (hit && (hit.distanceToRay ?? 1) < 0.9 && hit.index != null) {
        const s = stars[hit.index]
        const title = zh ? s.title : (s.titleEn ?? s.title)
        const book = zh ? s.bookTitle : (s.bookTitleEn ?? s.bookTitle)
        const chapter = zh ? s.chapter : (s.chapterEn ?? s.chapter)
        tooltip.style.display = 'block'
        tooltip.style.left = `${Math.min(mousePx.x + 14, host.clientWidth - 240)}px`
        tooltip.style.top = `${mousePx.y + 14}px`
        tooltip.innerHTML = `<div>${title}</div><div class="trail">${book}${chapter ? ' · ' + chapter : ''}</div>`
      } else tooltip.style.display = 'none'
    } else tooltip.style.display = 'none'

    renderer.render(scene, camera)
  }
  tick()

  const onVisibility = () => {
    running = !document.hidden
    if (running) tick()
    else cancelAnimationFrame(raf)
  }
  document.addEventListener('visibilitychange', onVisibility)

  const ro = new ResizeObserver(() => {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  ro.observe(host)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
    host.removeEventListener('wheel', onWheel)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerleave', onLeave)
    host.removeEventListener('pointerdown', onDown)
    host.removeEventListener('pointerup', onUp)
    ro.disconnect()
    controls.dispose()
    scene.traverse((o) => {
      const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } }
      m.geometry?.dispose()
      m.material?.dispose()
    })
    renderer.dispose()
    renderer.domElement.remove()
    labelLayer.remove()
    tooltip.remove()
  }
}
