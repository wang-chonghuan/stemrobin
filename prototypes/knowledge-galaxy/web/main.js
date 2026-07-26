import * as THREE from 'three'
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js'

const data = await (await fetch('./galaxy.json')).json()

// ---------- scene ----------
const stage = document.getElementById('stage')
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070f)
scene.fog = new THREE.Fog(0x05070f, 70, 190)

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 500)
camera.position.set(0, 46, 78)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 26
controls.maxDistance = 130
controls.minPolarAngle = 0.6   // keep a top-down-ish band: can't dive under the disc
controls.maxPolarAngle = 1.32
controls.autoRotate = true
controls.autoRotateSpeed = 0.25
let idleTimer
controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer) })
controls.addEventListener('end', () => { idleTimer = setTimeout(() => (controls.autoRotate = true), 4000) })

// ---------- layout: UMAP xy -> galaxy disc xz, thin y ----------
const S = 30 // world units per UMAP unit
const rand = (seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646)(42)

const DISC_COLOR = {
  math: new THREE.Color(0xffc46b),
  physics: new THREE.Color(0x6bc8ff),
}

const stars = data.stars
const N = stars.length
const pos = new Float32Array(N * 3)
const col = new Float32Array(N * 3)
const size = new Float32Array(N)
const phase = new Float32Array(N)
const starWorld = []

for (let i = 0; i < N; i++) {
  const s = stars[i]
  const x = s.x * S, z = s.y * S
  const y = (rand() - 0.5) * 3.2
  pos.set([x, y, z], i * 3)
  starWorld.push(new THREE.Vector3(x, y, z))
  const c = DISC_COLOR[s.discipline].clone()
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
  uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uDim: { value: -1 } },
  vertexShader: /* glsl */ `
    attribute vec3 aColor; attribute float aSize; attribute float aPhase;
    uniform float uTime, uPx;
    varying vec3 vColor; varying float vTw;
    void main() {
      vec3 p = position;
      // gentle breathing drift — the "弹动"
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

// ---------- hubs ----------
const hubs = data.hubs
const hubWorld = hubs.map(h => new THREE.Vector3(h.x * S, 0, h.y * S))
const hubGeo = new THREE.BufferGeometry()
const hpos = new Float32Array(hubs.length * 3)
const hcol = new Float32Array(hubs.length * 3)
const hsize = new Float32Array(hubs.length)
hubs.forEach((h, i) => {
  hpos.set([hubWorld[i].x, 0, hubWorld[i].z], i * 3)
  const c = DISC_COLOR[h.discipline].clone().offsetHSL(0, 0.05, 0.1)
  hcol.set([c.r, c.g, c.b], i * 3)
  hsize[i] = 3.2 + Math.sqrt(h.size) * 0.55
})
hubGeo.setAttribute('position', new THREE.BufferAttribute(hpos, 3))
hubGeo.setAttribute('aColor', new THREE.BufferAttribute(hcol, 3))
hubGeo.setAttribute('aSize', new THREE.BufferAttribute(hsize, 1))
hubGeo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(hubs.length).map(() => rand() * 6.28), 1))
const hubMat = starMat.clone()
const hubPoints = new THREE.Points(hubGeo, hubMat)
scene.add(hubPoints)

// ---------- hub-hub edges (arcs above the plane) ----------
const edgeGroup = new THREE.Group()
scene.add(edgeGroup)
const edgeMeta = []
for (const e of data.edges) {
  const a = hubWorld[e.a], b = hubWorld[e.b]
  const mid = a.clone().add(b).multiplyScalar(0.5)
  mid.y += a.distanceTo(b) * 0.22
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
  const pts = curve.getPoints(28)
  const g = new THREE.BufferGeometry().setFromPoints(pts)
  const ca = DISC_COLOR[hubs[e.a].discipline], cb = DISC_COLOR[hubs[e.b].discipline]
  const cols = new Float32Array(pts.length * 3)
  pts.forEach((_, i) => {
    const c = ca.clone().lerp(cb, i / (pts.length - 1))
    cols.set([c.r, c.g, c.b], i * 3)
  })
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const m = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const line = new THREE.Line(g, m)
  edgeGroup.add(line)
  edgeMeta.push({ line, a: e.a, b: e.b, w: e.w })
}

// ---------- hub labels (HTML overlay) ----------
const labelLayer = document.getElementById('labels')
const labelEls = hubs.map((h, i) => {
  const el = document.createElement('div')
  el.className = 'hub-label'
  el.textContent = h.name
  el.style.color = `#${DISC_COLOR[h.discipline].clone().offsetHSL(0, 0, 0.18).getHexString()}`
  el.style.fontSize = `${Math.round(12 + Math.sqrt(h.size) * 0.9)}px`
  labelLayer.appendChild(el)
  return el
})

// ---------- interaction ----------
const tooltip = document.getElementById('tooltip')
const raycaster = new THREE.Raycaster()
raycaster.params.Points.threshold = 1.1
const mouse = new THREE.Vector2(-2, -2)
let mousePx = { x: 0, y: 0 }
let hotHub = -1

addEventListener('pointermove', ev => {
  mouse.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1)
  mousePx = { x: ev.clientX, y: ev.clientY }
})

const neighborsOf = h => {
  const set = new Set([h])
  for (const e of data.edges) {
    if (e.a === h) set.add(e.b)
    if (e.b === h) set.add(e.a)
  }
  return set
}

function setHotHub(h) {
  if (h === hotHub) return
  hotHub = h
  const near = h >= 0 ? neighborsOf(h) : null
  labelEls.forEach((el, i) => {
    el.classList.toggle('hot', i === h)
    el.classList.toggle('dim', h >= 0 && !near.has(i))
  })
  edgeMeta.forEach(e => {
    const on = h >= 0 && (e.a === h || e.b === h)
    e.line.material.opacity = on ? 0.75 : h >= 0 ? 0.03 : 0.10
  })
  starMat.uniforms.uDim.value = -1 // reserved for cluster dimming pass
  document.body.style.cursor = h >= 0 ? 'pointer' : ''
}

// ---------- frame loop ----------
const proj = new THREE.Vector3()
const clock = new THREE.Clock()
let running = true
document.addEventListener('visibilitychange', () => {
  running = !document.hidden
  if (running) tick()
})

function tick() {
  if (!running) return
  requestAnimationFrame(tick)
  const t = clock.getElapsedTime()
  starMat.uniforms.uTime.value = t
  hubMat.uniforms.uTime.value = t
  controls.update()

  // project hub labels; pick nearest hub in screen space
  const placed = []
  let best = -1, bestD = 42 * 42
  const screen = hubs.map((h, i) => {
    proj.copy(hubWorld[i]).project(camera)
    return {
      i,
      sx: (proj.x * 0.5 + 0.5) * innerWidth,
      sy: (-proj.y * 0.5 + 0.5) * innerHeight,
      visible: proj.z < 1,
      w: labelEls[i].offsetWidth || h.name.length * 14,
    }
  })
  // big hubs claim space first; overlapping smaller labels hide (hot hub always wins)
  const order = [...screen].sort((p, q) =>
    (q.i === hotHub) - (p.i === hotHub) || hubs[q.i].size - hubs[p.i].size)
  for (const s of order) {
    const el = labelEls[s.i]
    if (!s.visible) { el.style.display = 'none'; continue }
    const collide = placed.some(p =>
      Math.abs(p.sy - s.sy) < 26 && Math.abs(p.sx - s.sx) < (p.w + s.w) / 2 + 10)
    if (collide && s.i !== hotHub) { el.style.display = 'none'; continue }
    placed.push(s)
    el.style.display = ''
    el.style.left = `${s.sx}px`
    el.style.top = `${s.sy}px`
    const dx = s.sx - mousePx.x, dy = s.sy - mousePx.y
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = s.i }
  }
  setHotHub(best)

  // topic star tooltip (only when not on a hub)
  if (best < 0) {
    raycaster.setFromCamera(mouse, camera)
    const hit = raycaster.intersectObject(starPoints, false)[0]
    if (hit && hit.distanceToRay < 0.9) {
      const s = stars[hit.index]
      tooltip.style.display = 'block'
      tooltip.style.left = `${mousePx.x + 14}px`
      tooltip.style.top = `${mousePx.y + 14}px`
      tooltip.innerHTML = `<div>${s.title}</div><div class="trail">${s.bookTitle ?? s.book} · ${s.chapter ?? ''}</div>`
    } else tooltip.style.display = 'none'
  } else tooltip.style.display = 'none'

  renderer.render(scene, camera)
}
tick()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
