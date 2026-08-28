import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRiver } from '../../lib/river.js'
import { clamp, damp } from '../../lib/math.js'
import { openViewer, setFocusPhoto } from '../../store/experience.js'
import { Photo } from './Photo.jsx'

/**
 * The overview: one line of photographs, drifting.
 *
 * A single horizontal sequence — a magazine spread unrolled — where size and
 * height change from frame to frame on a written rhythm. Nothing else is on
 * the screen. An earlier version stacked the work into three bands and it
 * read as three filmstrips: tiers, not a picture.
 *
 * Bring the pointer near a photograph and the current slows almost to a stop
 * while that frame rises toward you and leans a few degrees into the light.
 * Take the pointer away and the current resumes.
 *
 * The wheel does not zoom and does not scroll the page: it scrubs the current,
 * the way you would push a reel of film.
 *
 * Position and scale are written straight to the DOM inside one animation
 * frame. React renders the tiles once and then stays out of the way.
 */

/** How fast the line drifts, in px per second. */
const SPEED = 22
/** How close the pointer must be, in px, for a frame to answer. */
const REACH = 210
/** How much a frame grows when it does. */
const LIFT = 0.09
/** How far it leans toward the pointer, in degrees. */
const TILT = 5

export function Universe({ photos, compact, active = true }) {
  const surface = useRef(null)
  const nodes = useRef([])
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth)

  const frame = useRef({
    px: -1e4, py: -1e4,
    scrub: 0, scrubTarget: 0,     // extra offset from wheel or drag, in px
    rate: 1, rateTarget: 1,       // how fast the current runs, 0 → 1
    dragging: false, dragged: false, lastX: 0,
    focus: null,
  })

  const river = useMemo(
    () => buildRiver(photos, { compact, viewport }),
    [photos, compact, viewport],
  )

  const register = useCallback((i, node) => { nodes.current[i] = node }, [])

  useEffect(() => {
    const el = surface.current
    if (!el) return
    const f = frame.current

    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', onResize)

    const onPointerMove = (e) => {
      if (!active) return
      f.px = e.clientX
      f.py = e.clientY
      if (f.dragging) {
        f.scrubTarget -= e.movementX
        if (Math.abs(e.movementX) > 2) f.dragged = true
      }
    }
    const onPointerLeave = () => { f.px = -1e4; f.py = -1e4 }
    const onPointerDown = (e) => {
      if (!active || e.button !== 0) return
      f.dragging = true
      f.dragged = false
    }
    const onPointerUp = () => {
      f.dragging = false
      if (f.dragged) setTimeout(() => { f.dragged = false }, 0)
    }

    // The wheel pushes the reel along instead of zooming or scrolling.
    const onWheel = (e) => {
      if (!active) return
      e.preventDefault()
      f.scrubTarget += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.6
    }

    const onKey = (e) => {
      if (!active) return
      const step = window.innerWidth * 0.45
      if (e.key === 'ArrowRight') { e.preventDefault(); f.scrubTarget += step }
      if (e.key === 'ArrowLeft') { e.preventDefault(); f.scrubTarget -= step }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerleave', onPointerLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf
    let last = performance.now()
    let clock = 0

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      clock += dt

      const vw = window.innerWidth
      const vh = window.innerHeight
      const unit = vh                       // band heights are fractions of the viewport

      // The current eases to a near-stop while you are looking at something.
      f.rate = damp(f.rate, f.rateTarget, 3, dt)
      f.scrub = damp(f.scrub, f.scrubTarget, 5, dt)

      const pointerInside = f.px > -1000
      let nearest = null
      let nearestNear = 0.34        // below this, nothing is really being looked at

      const loopPx = river.loop * unit
      const flow = still ? 0 : clock * SPEED * f.rate

      for (let i = 0; i < river.frames.length; i++) {
        const node = nodes.current[i]
        if (!node) continue
        const item = river.frames[i]

        const w = item.w * unit
        const h = item.h * unit

        // The line lives on a loop wider than two screens, so a frame leaving
        // on the left is already re-entering on the right.
        const shift = (flow + f.scrub) * item.depth
        let cxp = (item.x * unit - shift) % loopPx
        if (cxp < -loopPx * 0.25) cxp += loopPx
        if (cxp > loopPx * 0.75) cxp -= loopPx

        const cyp = (item.y + Math.sin(clock * 0.11 + item.phase) * 0.007) * vh

        if (cxp + w / 2 < -80 || cxp - w / 2 > vw + 80) {
          if (node.style.visibility !== 'hidden') {
            node.style.visibility = 'hidden'
            node.style.pointerEvents = 'none'
          }
          continue
        }
        if (node.style.visibility === 'hidden') node.style.visibility = ''

        // Attention: how near the pointer is to this frame.
        let near = 0
        let leanX = 0
        let leanY = 0
        if (pointerInside) {
          const dx = f.px - cxp
          const dy = f.py - cyp
          const d = Math.hypot(dx, dy)
          near = Math.exp(-((d / REACH) ** 2))
          if (near > 0.02) {
            leanY = clamp(dx / REACH, -1, 1) * TILT * near
            leanX = clamp(-dy / REACH, -1, 1) * TILT * near
          }
          if (near > nearestNear) { nearestNear = near; nearest = item.photo }
        }

        const scale = 1 + LIFT * near
        node.style.width = `${w.toFixed(1)}px`
        node.style.height = `${h.toFixed(1)}px`
        node.style.transform =
          `translate3d(${(cxp - w / 2).toFixed(1)}px, ${(cyp - h / 2).toFixed(1)}px, 0)` +
          ` perspective(1000px) rotateX(${leanX.toFixed(2)}deg) rotateY(${leanY.toFixed(2)}deg)` +
          ` scale(${scale.toFixed(3)})`
        node.style.opacity = (item.dim + (1 - item.dim) * near).toFixed(3)
        node.style.zIndex = String(10 + Math.round(item.h * 20) + Math.round(near * 50))
        node.style.pointerEvents = 'auto'
      }

      f.rateTarget = nearest ? 0.1 : 1

      if (nearest !== f.focus) {
        f.focus = nearest
        setFocusPhoto(nearest)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerleave', onPointerLeave)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      setFocusPhoto(null)
    }
  }, [river, active])

  return (
    <div className="universe" ref={surface} {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      <div className="universe__vignette" aria-hidden="true" />
      {river.frames.map((item, i) => (
        <Photo
          key={item.key}
          image={item.photo}
          index={i}
          register={register}
          priority={i < 12}
          onOpen={() => { if (!frame.current.dragged) openViewer(item.photo) }}
        />
      ))}
    </div>
  )
}
