import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildCosmos } from '../../lib/constellation.js'
import { createCosmos } from '../../lib/cosmosScene.js'
import { clamp, damp } from '../../lib/math.js'
import { openViewer, setFocusPhoto } from '../../store/experience.js'
import { Photo } from './Photo.jsx'

/**
 * The overview: a night sky with one galaxy per body of work.
 *
 * At rest you see three galaxies turning slowly in a field of stars. Bring
 * the pointer to one and its photographs stream out of the core toward you,
 * settling into a loose spiral; take the pointer away and they fall back in.
 *
 * The sky is a canvas — stars, nebulae and spiral arms are far too many
 * objects to be elements. The photographs are real `<img>` tags, because they
 * are the one thing on this site that must stay pixel-sharp.
 *
 * There is no scrolling anywhere. The wheel is a crown: it zooms the whole
 * sky around wherever you are pointing. Dragging moves it.
 */

const ZOOM_MIN = 0.42
const ZOOM_MAX = 2.4
const TILE_PX = 1000
const FULL_PX = 2400

export function Universe({ sets, compact, active = true }) {
  const canvasRef = useRef(null)
  const layer = useRef(null)
  const nodes = useRef([])
  const frame = useRef({
    px: 0, py: 0,
    tx: 0, ty: 0, x: 0, y: 0,
    tz: 1, z: 1,
    vx: 0, vy: 0,
    dragging: false, dragged: false,
    pointers: new Map(), pinch: 0,
    focus: -1, lastFocus: -1,
    open: [],            // 0 → 1 per galaxy, how far its photographs are out
  })

  const cosmos = useMemo(() => buildCosmos(sets, { compact }), [sets, compact])
  const unit = compact ? 96 : 120

  /** One flat list, so a photograph can be found by a single index. */
  const flat = useMemo(() => cosmos.flatMap((set, s) =>
    set.burst.map((b, i) => ({ ...b, set, setIndex: s, indexInSet: i }))), [cosmos])

  const register = useCallback((i, entry) => { nodes.current[i] = entry }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const el = layer.current
    if (!canvas || !el) return

    const f = frame.current
    f.open = cosmos.map(() => 0)
    const scene = createCosmos(canvas, cosmos, { compact })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    f.px = window.innerWidth / 2
    f.py = window.innerHeight / 2

    /* ── input ─────────────────────────────────────────────────────── */

    const bound = () => {
      const reach = 9 * unit * f.z
      f.tx = clamp(f.tx, -reach, reach)
      f.ty = clamp(f.ty, -reach, reach)
    }

    const zoomAbout = (next, sx, sy) => {
      const z0 = f.tz
      const z1 = clamp(next, ZOOM_MIN, ZOOM_MAX)
      if (z1 === z0) return
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const wx = (sx - cx - f.tx) / z0
      const wy = (sy - cy - f.ty) / z0
      f.tx = sx - cx - wx * z1
      f.ty = sy - cy - wy * z1
      f.tz = z1
      bound()
    }

    const onPointerMove = (e) => {
      if (!active) return
      f.px = e.clientX
      f.py = e.clientY
      if (f.pointers.has(e.pointerId)) f.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (f.pointers.size === 2) {
        const [a, b] = [...f.pointers.values()]
        const dist = Math.hypot(b.x - a.x, b.y - a.y)
        if (f.pinch) zoomAbout(f.tz * (dist / f.pinch), (a.x + b.x) / 2, (a.y + b.y) / 2)
        f.pinch = dist
        f.dragged = true
        return
      }
      if (f.dragging) {
        f.tx += e.movementX
        f.ty += e.movementY
        f.vx = e.movementX
        f.vy = e.movementY
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) f.dragged = true
        bound()
      }
    }

    const onPointerDown = (e) => {
      if (!active) return
      f.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (f.pointers.size > 1) { f.pinch = 0; return }
      if (e.button !== 0) return
      f.dragging = true
      f.dragged = false
      f.vx = 0; f.vy = 0
    }

    const endPointer = (e) => {
      f.pointers.delete(e.pointerId)
      if (f.pointers.size < 2) f.pinch = 0
      if (f.pointers.size === 0) {
        f.dragging = false
        if (f.dragged) setTimeout(() => { f.dragged = false }, 0)
      }
    }

    const onWheel = (e) => {
      if (!active) return
      e.preventDefault()
      const raw = e.ctrlKey ? e.deltaY * 2.2 : e.deltaY
      zoomAbout(f.tz * Math.exp(-clamp(raw, -60, 60) * 0.0022), e.clientX, e.clientY)
      f.vx = 0; f.vy = 0
    }

    const onKey = (e) => {
      if (!active) return
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAbout(f.tz * 1.22, innerWidth / 2, innerHeight / 2) }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAbout(f.tz / 1.22, innerWidth / 2, innerHeight / 2) }
      if (e.key === '0') { e.preventDefault(); zoomAbout(1, innerWidth / 2, innerHeight / 2) }
      const step = window.innerHeight * 0.3
      const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
      const move = moves[e.key]
      if (!move) return
      e.preventDefault()
      f.tx += move[0]; f.ty += move[1]
      bound()
    }

    const onResize = () => scene.resize()

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', endPointer, { passive: true })
    window.addEventListener('pointercancel', endPointer, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)

    /* ── the frame ─────────────────────────────────────────────────── */

    let raf
    let last = performance.now()
    const started = last

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const time = (now - started) / 1000

      if (!f.dragging && (Math.abs(f.vx) > 0.1 || Math.abs(f.vy) > 0.1)) {
        f.tx += f.vx; f.ty += f.vy
        f.vx *= 0.94; f.vy *= 0.94
        bound()
      }

      f.x = damp(f.x, f.tx, 6, dt)
      f.y = damp(f.y, f.ty, 6, dt)
      f.z = damp(f.z, f.tz, 7, dt)

      const placed = scene.draw(f, unit, time, f.focus, f.open)

      // Which galaxy is the pointer on? On a touch screen the middle of the
      // screen does the pointing, exactly as it does on the watch.
      const fx = compact ? window.innerWidth / 2 : f.px
      const fy = compact ? window.innerHeight / 2 : f.py

      let focus = -1
      let best = Infinity
      for (let i = 0; i < placed.length; i++) {
        const g = placed[i]
        const d = Math.hypot(fx - g.x, fy - g.y)
        // Generous while the photographs are out, so moving toward one of
        // them does not slam the galaxy shut on the way.
        const reach = g.radius * (1.15 + f.open[i] * 1.5)
        if (d < reach && d < best) { best = d; focus = i }
      }
      f.focus = focus

      for (let i = 0; i < cosmos.length; i++) {
        f.open[i] = damp(f.open[i], focus === i ? 1 : 0, focus === i ? 3.4 : 2.6, dt)
      }

      // Photographs.
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const scale = unit * f.z
      let lead = -1
      let leadNear = Infinity

      for (let i = 0; i < flat.length; i++) {
        const entry = nodes.current[i]
        if (!entry?.el) continue
        const b = flat[i]
        const g = cosmos[b.setIndex].place
        const node = entry.el

        // Each photograph has its own moment inside the galaxy's opening.
        const t = clamp((f.open[b.setIndex] - b.delay) / (1 - b.delay))
        if (t < 0.002) {
          if (node.style.visibility !== 'hidden') {
            node.style.visibility = 'hidden'
            node.style.pointerEvents = 'none'
          }
          continue
        }
        if (node.style.visibility === 'hidden') node.style.visibility = ''

        const ease = t * t * (3 - 2 * t)
        const px = cx + (g.x + b.x * ease) * scale + f.x
        const py = cy + (g.y + b.y * ease) * scale + f.y
        const w = b.w * scale
        const h = b.h * scale

        // Grows past its resting size on the way out — that overshoot is what
        // reads as coming toward you rather than merely appearing.
        const pop = 1 + Math.sin(ease * Math.PI) * 0.16
        const size = (0.12 + ease * 0.88) * pop

        node.style.width = `${w.toFixed(1)}px`
        node.style.height = `${h.toFixed(1)}px`
        node.style.transform =
          `translate3d(${(px - w / 2).toFixed(1)}px, ${(py - h / 2).toFixed(1)}px, 0)` +
          ` scale(${size.toFixed(3)}) rotate(${(b.spinOut * (1 - ease)).toFixed(3)}rad)`
        node.style.opacity = ease.toFixed(3)
        node.style.pointerEvents = ease > 0.55 ? 'auto' : 'none'
        node.style.zIndex = String(20 + Math.round(ease * 60))

        entry.setHiRes(w * dpr * 1.2 > TILE_PX * 0.78)

        if (ease > 0.6) {
          const d = Math.hypot(fx - px, fy - py)
          if (d < leadNear) { leadNear = d; lead = i }
        }
      }

      // One caption: whichever photograph the pointer is nearest, or the
      // galaxy itself while its photographs are still on their way out.
      const label = lead >= 0 && leadNear < 260 ? flat[lead].image
        : focus >= 0 ? { setTitle: cosmos[focus].title, setSubtitle: cosmos[focus].subtitle, number: String(cosmos[focus].images.length).padStart(2, '0') }
        : null
      if (label !== f.lastFocus) {
        f.lastFocus = label
        setFocusPhoto(label)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', endPointer)
      window.removeEventListener('pointercancel', endPointer)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      setFocusPhoto(null)
    }
  }, [cosmos, flat, unit, compact, active])

  return (
    <div className="universe" {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      <canvas ref={canvasRef} className="cosmos" aria-hidden="true" />
      <div ref={layer} className="universe__layer">
        {flat.map((b, i) => (
          <Photo
            key={b.image.id}
            image={b.image}
            index={i}
            register={register}
            priority={b.indexInSet < 3}
            onOpen={() => { if (!frame.current.dragged) openViewer(b.image) }}
          />
        ))}
      </div>
    </div>
  )
}
