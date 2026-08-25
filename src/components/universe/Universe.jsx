import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildConstellation } from '../../lib/constellation.js'
import { clamp, damp } from '../../lib/math.js'
import { openViewer, setFocusPhoto } from '../../store/experience.js'
import { Photo } from './Photo.jsx'

/**
 * The universe: every photograph on one plane, at its own proportions.
 *
 * There is no scrolling anywhere on this site. The wheel is a crown — it
 * zooms the whole field in and out around wherever you are pointing. Dragging
 * moves it. Nothing else moves at all.
 *
 * Everything below runs in a single animation frame and writes straight to
 * the DOM. React lays the tiles out once and is then out of the loop, which is
 * what lets fifty photographs zoom and magnify together at 60fps.
 */

/**
 * The three numbers that decide whether this field reads as a exhibition or
 * as noise. They are deliberately conservative.
 *
 * A photograph needs stillness to be looked at. So: the lens is gentle, it
 * arrives late (every tile eases toward its target rather than snapping to
 * the pointer), and frames away from your attention fall a long way back —
 * which turns density into depth instead of clutter.
 */
/** How much a frame grows directly under the pointer. */
const MAGNIFY = 0.20
/** Radius of that influence at zoom 1, in pixels. */
const REACH = 360
/** How much frames dim toward the edges of the screen. */
const FALLOFF = 0.22
/**
 * How present a frame stays when it is not the one you are looking at.
 * High enough that the field still reads as photographs at rest — dropping
 * this much below 0.5 makes the room look switched off.
 */
const RECEDE = 0.40
/** How eagerly a tile follows the pointer. Low is calm; high is twitchy. */
const EASE = 5.5

/** Source widths, in pixels — see scripts/sources.json. */
const TILE_PX = 1000
const FULL_PX = 2400
/** Smallest a photograph is allowed to get, in CSS pixels. */
const MIN_TILE_PX = { compact: 84, roomy: 128 }

export function Universe({ photos, compact, active = true }) {
  const plane = useRef(null)
  const items = useRef([])          // { el, setHiRes } per tile, filled on mount
  const frame = useRef({
    px: 0, py: 0,          // pointer, screen space
    tx: 0, ty: 0,          // pan target
    x: 0, y: 0,            // pan, smoothed
    tz: 1, z: 1,           // zoom target, zoom smoothed
    vx: 0, vy: 0,          // throw velocity
    dragging: false,
    dragged: false,
    pointers: new Map(),   // live touches, for pinch
    pinch: 0,              // distance between two fingers, last frame
    lastFocus: -1,
  })
  // Per-tile eased values, kept outside React and outside the DOM.
  const eased = useRef({ scale: null, light: null })

  const layout = useMemo(
    () => buildConstellation(photos, { spread: compact ? 1.08 : 1 }),
    [photos, compact],
  )

  // One world unit → pixels at zoom 1.
  const unit = compact ? 168 : 220

  // The frames nearest the centre are the ones on screen when the page opens.
  const eager = useMemo(() => {
    const order = layout.items
      .map((item, i) => ({ i, d: Math.hypot(item.x, item.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, compact ? 10 : 14)
    return new Set(order.map((o) => o.i))
  }, [layout, compact])

  const register = useCallback((index, entry) => { items.current[index] = entry }, [])

  /**
   * Both ends of the crown, derived from the photographs themselves rather
   * than guessed:
   *
   *   in  — the point where the largest frame, at full magnification, would
   *         be asked to draw more device pixels than the 2400px original
   *         holds. Past that it would visibly break up, so it stops.
   *   out — the point where a middling frame shrinks below a size you could
   *         still read as a photograph.
   *
   * Change the source sizes in the pipeline and these follow on their own.
   */
  const limits = useMemo(() => {
    const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2)
    const widths = layout.items.map((i) => i.w).sort((a, b) => a - b)
    const median = widths[Math.floor(widths.length / 2)] ?? 0.87
    const widest = widths[widths.length - 1] ?? 1.2

    // The pointer lens fades out as the crown turns in (see `lens` below), so
    // the ceiling only has to account for the frame itself, not the lens.
    const max = (FULL_PX * 0.98) / (widest * unit * dpr)
    const min = (compact ? MIN_TILE_PX.compact : MIN_TILE_PX.roomy) / (median * unit)
    return {
      max: clamp(max, 1.8, 5),
      min: clamp(min, 0.3, 0.95),
    }
  }, [layout, unit, compact])

  useEffect(() => {
    const el = plane.current
    if (!el) return
    const f = frame.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)


    // Rubber band: the cluster may leave the screen, but never entirely.
    const boundPan = () => {
      const halfW = (layout.width * unit * f.z) / 2
      const halfH = (layout.height * unit * f.z) / 2
      const limitX = Math.max(halfW - window.innerWidth * 0.34, 0)
      const limitY = Math.max(halfH - window.innerHeight * 0.34, 0)
      f.tx = clamp(f.tx, -limitX, limitX)
      f.ty = clamp(f.ty, -limitY, limitY)
    }

    /**
     * Zoom about a point on screen, so whatever you are pointing at stays
     * under the pointer. Without this the field slides away as it grows and
     * the gesture stops feeling like a crown.
     */
    const zoomAbout = (nextZoom, sx, sy) => {
      const z0 = f.tz
      const z1 = clamp(nextZoom, limits.min, limits.max)
      if (z1 === z0) return
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const worldX = (sx - cx - f.tx) / z0
      const worldY = (sy - cy - f.ty) / z0
      f.tx = sx - cx - worldX * z1
      f.ty = sy - cy - worldY * z1
      f.tz = z1
      boundPan()
    }

    f.px = window.innerWidth / 2
    f.py = window.innerHeight / 2
    f.tz = f.z = clamp(1, limits.min, limits.max)

    /* ── Pointer ─────────────────────────────────────────────────────── */
    const onPointerMove = (e) => {
      if (!active) return
      f.px = e.clientX
      f.py = e.clientY

      if (f.pointers.has(e.pointerId)) f.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      // Two fingers: pinch. The midpoint is the anchor, exactly like a map.
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
        boundPan()
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
      // Deliberately no setPointerCapture: capturing here would redirect the
      // click away from the photograph and nothing would ever open.
    }

    const endPointer = (e) => {
      f.pointers.delete(e.pointerId)
      if (f.pointers.size < 2) f.pinch = 0
      if (f.pointers.size === 0) {
        f.dragging = false
        if (f.dragged) setTimeout(() => { f.dragged = false }, 0)
      }
    }

    /* ── The crown ───────────────────────────────────────────────────── */
    const onWheel = (e) => {
      if (!active) return
      e.preventDefault()
      // A trackpad pinch arrives as ctrl+wheel with small deltas; a mouse
      // wheel arrives as large ones. Both should feel like the same crown.
      const raw = e.ctrlKey ? e.deltaY * 2.2 : e.deltaY
      const factor = Math.exp(-clamp(raw, -60, 60) * 0.0022)
      zoomAbout(f.tz * factor, e.clientX, e.clientY)
      f.vx = 0; f.vy = 0
    }

    const onKey = (e) => {
      // While a panel or the viewer is open, the keyboard belongs to them.
      if (!active) return
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAbout(f.tz * 1.25, innerWidth / 2, innerHeight / 2) }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAbout(f.tz / 1.25, innerWidth / 2, innerHeight / 2) }
      if (e.key === '0') { e.preventDefault(); zoomAbout(1, innerWidth / 2, innerHeight / 2) }
      const step = window.innerHeight * 0.3
      const moves = {
        ArrowLeft: [step, 0], ArrowRight: [-step, 0],
        ArrowUp: [0, step], ArrowDown: [0, -step],
      }
      const move = moves[e.key]
      if (!move) return
      e.preventDefault()
      f.tx += move[0]
      f.ty += move[1]
      boundPan()
    }

    const onResize = () => { f.tz = clamp(f.tz, limits.min, limits.max); boundPan() }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', endPointer, { passive: true })
    window.addEventListener('pointercancel', endPointer, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)

    let raf
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      if (!f.dragging && (Math.abs(f.vx) > 0.1 || Math.abs(f.vy) > 0.1)) {
        f.tx += f.vx
        f.ty += f.vy
        f.vx *= 0.94
        f.vy *= 0.94
        boundPan()
      }

      f.x = damp(f.x, f.tx, 6, dt)
      f.y = damp(f.y, f.ty, 6, dt)
      f.z = damp(f.z, f.tz, 7, dt)

      const z = f.z
      el.style.transform =
        `translate3d(${f.x.toFixed(2)}px, ${f.y.toFixed(2)}px, 0) scale(${z.toFixed(4)})`

      const vw = window.innerWidth
      const vh = window.innerHeight
      const cx = vw / 2
      const cy = vh / 2

      // On a touch screen there is no pointer, so the centre of the screen
      // does the pointing — which is exactly how the watch behaves.
      const fx = compact ? cx : f.px
      const fy = compact ? cy : f.py

      const reach = (compact ? REACH * 0.85 : REACH) * Math.sqrt(z)

      // The magnifying lens belongs to the wide view. Once a photograph
      // already owns a third of the screen, growing it further is just noise —
      // so the lens fades out as the crown turns in, and by the ceiling it is
      // gone entirely. That is also what lets the ceiling sit as high as the
      // 2400px file allows.
      const lens = MAGNIFY * clamp((limits.max - z) / Math.max(limits.max - 1, 0.001))
      const maxEdge = Math.hypot(cx, cy)

      let bestIndex = -1
      let best = 0

      const n = layout.items.length
      if (eased.current.scale?.length !== n) {
        eased.current.scale = new Float32Array(n).fill(1)
        eased.current.light = new Float32Array(n).fill(RECEDE)
      }
      const { scale: easedScale, light: easedLight } = eased.current

      for (let i = 0; i < layout.items.length; i++) {
        const entry = items.current[i]
        if (!entry?.el) continue
        const item = layout.items[i]
        const node = entry.el

        const sx = cx + item.x * unit * z + f.x
        const sy = cy + item.y * unit * z + f.y
        const halfW = (item.w * unit * z) / 2
        const halfH = (item.h * unit * z) / 2

        if (sx + halfW < -300 || sx - halfW > vw + 300 ||
            sy + halfH < -300 || sy - halfH > vh + 300) {
          if (node.style.visibility !== 'hidden') node.style.visibility = 'hidden'
          continue
        }
        if (node.style.visibility === 'hidden') node.style.visibility = ''

        const d = Math.hypot(sx - fx, sy - fy)
        const near = Math.exp(-((d / reach) ** 2))
        const edge = 1 - FALLOFF * clamp(Math.hypot(sx - cx, sy - cy) / maxEdge)

        // Ease toward the target rather than assigning it. The pointer can
        // move as fast as it likes; the light in the room takes its time.
        easedScale[i] = damp(easedScale[i], (1 + lens * near) * edge, EASE, dt)
        easedLight[i] = damp(easedLight[i], RECEDE + (1 - RECEDE) * near * edge, EASE, dt)

        const mag = 1 + lens * near
        node.style.transform = `translate3d(-50%, -50%, 0) scale(${easedScale[i].toFixed(3)})`
        node.style.opacity = easedLight[i].toFixed(3)
        node.style.zIndex = String(100 + Math.round(near * 100))

        // Resolution pyramid: as a tile approaches the width of the file
        // behind it, the 2400px original is fetched and laid over the top.
        // The request goes out at 78% of the limit so the sharper file has
        // arrived by the time it is actually needed — zoom deep and there is
        // never a soft moment, only a photograph.
        entry.setHiRes(item.w * unit * z * mag * dpr > TILE_PX * 0.78)

        if (near > best) { best = near; bestIndex = i }
      }

      const focus = best > 0.42 ? bestIndex : -1
      if (focus !== f.lastFocus) {
        f.lastFocus = focus
        setFocusPhoto(focus >= 0 ? layout.items[focus].photo : null)
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
  }, [layout, unit, compact, limits, active])

  return (
    // `inert` rather than aria-hidden: while a panel is open the field must be
    // unreachable by the keyboard too, not merely unannounced.
    <div className="universe" {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      <div ref={plane} className="universe__plane">
        {layout.items.map((item, i) => (
          <Photo
            key={item.photo.id}
            item={item}
            unit={unit}
            index={i}
            register={register}
            priority={eager.has(i)}
            onOpen={() => { if (!frame.current.dragged) openViewer(item.photo) }}
          />
        ))}
      </div>
    </div>
  )
}
