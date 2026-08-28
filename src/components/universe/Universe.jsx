import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildWall, EYE } from '../../lib/wall.js'
import { clamp, damp } from '../../lib/math.js'
import { openViewer, setFocusPhoto } from '../../store/experience.js'
import { Photo } from './Photo.jsx'

/**
 * The overview: an exhibition wall.
 *
 * Photographs hung in a line, still, each series opened by its wall text.
 * Nothing moves on its own and nothing overlaps. You walk along it with the
 * wheel, a drag, or the arrow keys, and the wall has a beginning and an end
 * the way a room does.
 *
 * You stand in front of one work at a time: the wall settles onto whichever
 * piece you walked to, and its neighbours fall back — smaller, dimmer, waiting
 * at the edge of vision. An earlier version fitted five works on the screen at
 * once and the eye had nowhere to rest.
 *
 * Earlier versions of this page drifted, layered and orbited. Every one of
 * them ended up competing with the photographs. A wall does not compete.
 *
 * Position is written straight to the DOM inside one animation frame; React
 * renders the works once and then holds still.
 */

/** Wheel travel needed before the wall steps to the next work. */
const NOTCH = 90
/** How far back a neighbour falls: scale and light lost across one screen. */
const FALL = 0.3
const SHADE = 0.68

export function Universe({ sets, compact, active = true }) {
  const room = useRef(null)
  const nodes = useRef([])
  const [, setTick] = useState(0)

  const wall = useMemo(() => buildWall(sets, { compact }), [sets, compact])

  const view = useRef({
    x: 0, target: 0,      // how far along the wall we have walked, in px
    at: 0,                // which work we are standing in front of
    wheel: 0,             // wheel travel banked toward the next step
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

    /** Where the wall must stand for work `i` to hold the middle of the room. */
    const standAt = (i) => {
      const item = wall.items[clamp(i, 0, wall.items.length - 1)]
      const vh = window.innerHeight
      return clamp(
        item.x * vh + (item.w * vh) / 2 - window.innerWidth / 2,
        0, limit(),
      )
    }

    const stepTo = (i) => {
      v.at = clamp(i, 0, wall.items.length - 1)
      v.target = standAt(v.at)
      v.wheel = 0
    }

    /** After a free drag, settle onto whichever work ended up nearest. */
    const settle = () => {
      const vh = window.innerHeight
      const middle = v.target + window.innerWidth / 2
      let best = 0
      let near = Infinity
      wall.items.forEach((item, i) => {
        const d = Math.abs(item.x * vh + (item.w * vh) / 2 - middle)
        if (d < near) { near = d; best = i }
      })
      stepTo(best)
    }

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
      if (!v.dragging) return
      v.dragging = false
      if (v.dragged) { settle(); setTimeout(() => { v.dragged = false }, 0) }
    }

    // The wheel walks you along the wall, one work per turn. It does not zoom
    // and it does not scroll the page — there is one direction in a room.
    const onWheel = (e) => {
      if (!active) return
      e.preventDefault()
      v.wheel += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (v.wheel > NOTCH) stepTo(v.at + 1)
      else if (v.wheel < -NOTCH) stepTo(v.at - 1)
    }

    const onKey = (e) => {
      if (!active) return
      const moves = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }
      if (e.key === 'Home') { e.preventDefault(); stepTo(0); return }
      if (e.key === 'End') { e.preventDefault(); stepTo(wall.items.length - 1); return }
      const move = moves[e.key]
      if (move === undefined) return
      e.preventDefault()
      stepTo(v.at + move)
    }

    const onResize = () => { setTick((n) => n + 1); v.target = standAt(v.at) }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerleave', onPointerLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)

    // Stand in the right place from the first frame. Sliding into position on
    // load would read as the room moving on its own, which is the one thing
    // this page is not supposed to do.
    stepTo(0)
    v.x = v.target

    let raf
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      const vw = window.innerWidth
      const vh = window.innerHeight
      v.x = damp(v.x, v.target, v.dragging ? 14 : 5, dt)

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

        // How far this piece is from the middle of the room, in screens.
        const away = clamp(Math.abs(left + w / 2 - vw / 2) / vw, 0, 1)
        const near = 1 - away / 0.5      // 1 in the middle, 0 half a screen out
        const held = clamp(near)

        if (item.kind === 'panel') {
          node.style.width = `${w.toFixed(1)}px`
          // translateY(-50%) after the move, so the text block is centred on
          // the same eye-level line the works hang from.
          node.style.transform =
            `translate3d(${left.toFixed(1)}px, ${(EYE * vh).toFixed(1)}px, 0) translateY(-50%)`
          node.style.opacity = (0.25 + 0.75 * held).toFixed(3)
          continue
        }

        const h = item.h * vh
        const top = EYE * vh - h / 2       // every work on the same centre line
        // Neighbours fall back rather than compete: smaller, and further into
        // the dark the further they are from where you are standing.
        const scale = 1 - FALL * (1 - held)
        node.style.width = `${w.toFixed(1)}px`
        node.style.height = `${h.toFixed(1)}px`
        node.style.transform =
          `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`
        node.style.opacity = (1 - SHADE * (1 - held)).toFixed(3)
        node.style.zIndex = String(10 + Math.round(held * 40))

        // The caption belongs to whatever is holding the room.
        if (held > 0.55 && away < closest) { closest = away; looking = item }
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
