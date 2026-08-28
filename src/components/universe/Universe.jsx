import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildWall, EYE } from '../../lib/wall.js'
import { clamp, damp } from '../../lib/math.js'
import { openViewer, setFocusPhoto } from '../../store/experience.js'
import { Photo } from './Photo.jsx'

/**
 * The overview: an exhibition wall.
 *
 * Photographs hung in a line, still, evenly spaced, each series opened by its
 * wall text. Nothing moves on its own and nothing overlaps. You walk along it
 * with the wheel, a drag, or the arrow keys, and the wall has a beginning and
 * an end the way a room does.
 *
 * Earlier versions of this page drifted, layered and orbited. Every one of
 * them ended up competing with the photographs. A wall does not compete.
 *
 * Position is written straight to the DOM inside one animation frame; React
 * renders the works once and then holds still.
 */

/** How far the wall travels per notch of the wheel, in viewport heights. */
const WHEEL = 0.0016

export function Universe({ sets, compact, active = true }) {
  const room = useRef(null)
  const nodes = useRef([])
  const [, setTick] = useState(0)

  const wall = useMemo(() => buildWall(sets, { compact }), [sets, compact])

  const view = useRef({
    x: 0, target: 0,      // how far along the wall we have walked, in px
    px: -1e4, py: -1e4,
    dragging: false, dragged: false,
    focus: null,
  })

  const register = useCallback((i, node) => { nodes.current[i] = node }, [])

  useEffect(() => {
    const el = room.current
    if (!el) return
    const v = view.current

    const limit = () => Math.max(wall.width * window.innerHeight - window.innerWidth, 0)

    const onPointerMove = (e) => {
      if (!active) return
      v.px = e.clientX
      v.py = e.clientY
      if (v.dragging) {
        v.target = clamp(v.target - e.movementX, 0, limit())
        if (Math.abs(e.movementX) > 2) v.dragged = true
      }
    }
    const onPointerLeave = () => { v.px = -1e4; v.py = -1e4 }
    const onPointerDown = (e) => {
      if (!active || e.button !== 0) return
      v.dragging = true
      v.dragged = false
    }
    const onPointerUp = () => {
      v.dragging = false
      if (v.dragged) setTimeout(() => { v.dragged = false }, 0)
    }

    // The wheel walks you along the wall. It does not zoom and it does not
    // scroll the page — there is only one direction to go in a room like this.
    const onWheel = (e) => {
      if (!active) return
      e.preventDefault()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      v.target = clamp(v.target + delta * WHEEL * window.innerHeight, 0, limit())
    }

    const onKey = (e) => {
      if (!active) return
      const step = window.innerWidth * 0.6
      const moves = { ArrowRight: step, ArrowLeft: -step, PageDown: step, PageUp: -step }
      if (e.key === 'Home') { e.preventDefault(); v.target = 0; return }
      if (e.key === 'End') { e.preventDefault(); v.target = limit(); return }
      const move = moves[e.key]
      if (move === undefined) return
      e.preventDefault()
      v.target = clamp(v.target + move, 0, limit())
    }

    const onResize = () => { setTick((n) => n + 1); v.target = clamp(v.target, 0, limit()) }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerleave', onPointerLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)

    let raf
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      const vw = window.innerWidth
      const vh = window.innerHeight
      v.x = damp(v.x, v.target, 7, dt)

      let looking = null
      let closest = Infinity

      for (let i = 0; i < wall.items.length; i++) {
        const node = nodes.current[i]
        if (!node) continue
        const item = wall.items[i]

        const w = item.w * vh
        const left = item.x * vh - v.x

        if (left + w < -80 || left > vw + 80) {
          if (node.style.visibility !== 'hidden') {
            node.style.visibility = 'hidden'
            node.style.pointerEvents = 'none'
          }
          continue
        }
        if (node.style.visibility === 'hidden') {
          node.style.visibility = ''
          node.style.pointerEvents = item.kind === 'photo' ? 'auto' : 'none'
        }

        if (item.kind === 'panel') {
          node.style.width = `${w.toFixed(1)}px`
          // translateY(-50%) after the move, so the text block is centred on
          // the same eye-level line the works hang from.
          node.style.transform =
            `translate3d(${left.toFixed(1)}px, ${(EYE * vh).toFixed(1)}px, 0) translateY(-50%)`
          continue
        }

        const h = item.h * vh
        const top = EYE * vh - h / 2       // every work on the same centre line
        node.style.width = `${w.toFixed(1)}px`
        node.style.height = `${h.toFixed(1)}px`
        node.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`

        // Which work is being looked at — for the caption, nothing more.
        const cx = left + w / 2
        const inside = v.px >= left && v.px <= left + w && v.py >= top && v.py <= top + h
        const d = Math.abs(v.px - cx)
        if (inside && d < closest) { closest = d; looking = item }
      }

      const label = looking
        ? { ...looking.image, number: String(looking.number).padStart(2, '0') }
        : null
      if ((label?.id ?? null) !== (v.focus?.id ?? null)) {
        v.focus = label
        setFocusPhoto(label)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerleave', onPointerLeave)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      setFocusPhoto(null)
    }
  }, [wall, active])

  return (
    <div className="room" ref={room} {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      {wall.items.map((item, i) =>
        item.kind === 'panel' ? (
          <div key={item.key} className="wall-text" ref={(n) => register(i, n)}>
            <span className="wall-text__num micro">{item.set.number}</span>
            <h2 className="wall-text__title serif">{item.set.title}</h2>
            <p className="wall-text__sub meta">{item.set.subtitle}</p>
            <p className="wall-text__note">{item.set.description}</p>
            <p className="wall-text__meta micro">
              {item.set.location} · {item.set.year} · {String(item.set.images.length).padStart(2, '0')} ảnh
            </p>
          </div>
        ) : (
          <Photo
            key={item.key}
            image={item.image}
            index={i}
            register={register}
            priority={i < 8}
            onOpen={() => { if (!view.current.dragged) openViewer(item.image) }}
          />
        ),
      )}
    </div>
  )
}
