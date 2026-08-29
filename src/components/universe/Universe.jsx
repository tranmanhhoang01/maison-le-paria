import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildScenes } from '../../lib/scenes.js'
import { clamp } from '../../lib/math.js'
import { openViewer } from '../../store/experience.js'
import { travelTo } from '../../lib/transition.js'
import { Plate } from './Plate.jsx'

/**
 * The overview: the house in five screens.
 *
 * An opening that says who this is, one chapter per series showing three
 * frames apiece, and a closing that says how to reach them. It is not a
 * gallery — the library is the gallery, and for several drafts this page was
 * a second one, which is why it never had anything to say.
 *
 * Movement is one CSS transition on one element. There is no animation loop:
 * while a finger is down the track follows it through a single direct style
 * write, and when it lifts the transition takes over. Everything else — the
 * wheel, the arrow keys, the marks — sets a chapter number and lets the same
 * transition do the work.
 */

/** How far a drag must travel before it counts as a page turn. */
const TURN = 0.12          // of the viewport
const FLICK = 0.45         // px per ms — a fast, short swipe still turns
const FLICK_MIN = 40       // ...but a twitch is not a swipe
/** The wheel keeps arriving long after a trackpad gesture ends. */
const WHEEL_STEP = 90
const WHEEL_LOCK = 700     // ms of quiet demanded after a turn
const WHEEL_RESET = 160    // ms of quiet that empties the accumulator

export function Universe({ sets, active = true }) {
  const scenes = useMemo(() => buildScenes(sets), [sets])
  const [at, setAt] = useState(0)
  const track = useRef(null)
  const wheel = useRef({ sum: 0, last: 0, until: 0 })
  const drag = useRef(null)

  const go = useCallback(
    (i) => setAt((cur) => clamp(typeof i === 'function' ? i(cur) : i, 0, scenes.length - 1)),
    [scenes.length],
  )

  /**
   * The track's transform is written here rather than handed to React as a
   * style prop: the drag writes to the same property between renders, and two
   * owners for one property is how a page starts stuttering.
   */
  const settle = useCallback((offset = 0) => {
    const el = track.current
    if (!el) return
    el.style.transform = `translate3d(calc(${-at * 100}vw + ${offset}px), 0, 0)`
  }, [at])

  useEffect(() => { settle() }, [settle])

  useEffect(() => {
    if (!active) return

    const onWheel = (e) => {
      e.preventDefault()
      const now = performance.now()
      const w = wheel.current
      if (now - w.last > WHEEL_RESET) w.sum = 0
      w.last = now
      // Still inside the last turn: swallow the event and let the tail of the
      // gesture drain away, rather than banking it towards the next one.
      if (now < w.until) { w.sum = 0; return }
      w.sum += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(w.sum) < WHEEL_STEP) return
      const dir = w.sum > 0 ? 1 : -1
      w.sum = 0
      w.until = now + WHEEL_LOCK
      go((c) => c + dir)
    }

    const onKey = (e) => {
      const moves = { ArrowRight: 1, PageDown: 1, ArrowDown: 1, ArrowLeft: -1, PageUp: -1, ArrowUp: -1 }
      if (e.key === 'Home') { e.preventDefault(); go(0); return }
      if (e.key === 'End') { e.preventDefault(); go(scenes.length - 1); return }
      const move = moves[e.key]
      if (move === undefined) return
      e.preventDefault()
      go((c) => c + move)
    }

    const onDown = (e) => {
      if (e.button !== 0) return
      drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, dx: 0 }
    }

    const onMove = (e) => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      // A vertical intention is not a page turn — let it go rather than
      // dragging the whole house sideways under the finger.
      if (!d.moved && Math.abs(dx) < 8) {
        if (Math.abs(e.clientY - d.y) > 14) { drag.current = null }
        return
      }
      if (!d.moved) { d.moved = true; track.current?.setAttribute('data-dragging', 'true') }
      // Resistance at the two ends, so the house feels bounded rather than broken.
      const edge = (at === 0 && dx > 0) || (at === scenes.length - 1 && dx < 0)
      d.dx = edge ? dx * 0.28 : dx
      settle(d.dx)
    }

    const onUp = (e) => {
      const d = drag.current
      drag.current = null
      if (!d) return
      track.current?.removeAttribute('data-dragging')
      if (!d.moved) return
      const dx = e.clientX - d.x
      const speed = Math.abs(dx) / Math.max(1, performance.now() - d.t)
      const far = Math.abs(dx) > window.innerWidth * TURN
        || (speed > FLICK && Math.abs(dx) > FLICK_MIN)
      if (far) go((c) => c + (dx < 0 ? 1 : -1))
      settle()   // if the chapter did not change, slide back to where it was
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [active, scenes.length, go, settle, at])

  // A click that ended a drag is not a click on a photograph.
  const opened = (image) => { if (!drag.current?.moved) openViewer(image) }

  return (
    <div className="overview" {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      <div className="overview__track" ref={track}>
        {scenes.map((scene, i) => (
          <section
            key={scene.key}
            className="scene"
            data-kind={scene.kind}
            data-here={i === at}
            aria-hidden={i !== at}
          >
            {scene.kind === 'opening' && (
              <>
                {scene.backdrop && (
                  <div
                    className="scene__backdrop"
                    style={{
                      backgroundImage: `url(${scene.backdrop.wide}), url(${scene.backdrop.lqip})`,
                      opacity: scene.veil,
                    }}
                    aria-hidden="true"
                  />
                )}
                <div className="scene__centre">
                  <span className="seal lift" aria-hidden="true"><span>M</span></span>
                  <h1 className="scene__name serif lift">
                    <span>MAISON</span><span>LE PARIA</span>
                  </h1>
                  <p className="scene__tagline meta lift">{scene.tagline}</p>
                  <div className="meander meander--short scene__ornament lift" aria-hidden="true" />
                  <p className="scene__line lift">{scene.line}</p>
                </div>
              </>
            )}

            {scene.kind === 'series' && (
              <div className="series-scene" data-hang={scene.hang}>
                <header className="series-scene__text">
                  <span className="series-scene__num micro lift">
                    CHƯƠNG {scene.set.number} · {scene.set.category ?? scene.set.subtitle}
                  </span>
                  <h2 className="series-scene__title serif lift">{scene.set.title}</h2>
                  <p className="series-scene__note lift">{scene.set.description}</p>
                  <p className="series-scene__meta micro lift">
                    {scene.set.location} · {scene.set.year} · {String(scene.set.images.length).padStart(2, '0')} ảnh
                  </p>
                  <button className="series-scene__more meta lift" onClick={() => travelTo(`/thu-vien/${scene.set.id}`)}>
                    XEM CẢ BỘ <span aria-hidden="true">→</span>
                  </button>
                </header>

                <div className="series-scene__plates" data-count={scene.plates.length}>
                  {scene.plates.map((image, n) => (
                    <Plate key={image.id} image={image} slot={n} onOpen={() => opened(image)} />
                  ))}
                </div>
              </div>
            )}

            {scene.kind === 'closing' && (
              <div className="scene__centre">
                <h2 className="scene__name serif lift">{scene.headline}</h2>
                <div className="meander meander--short scene__ornament lift" aria-hidden="true" />
                <p className="scene__line lift">{scene.note}</p>
                <ul className="closing__channels lift">
                  {scene.channels.map((c) => (
                    <li key={c.label}>
                      <span className="micro">{c.label}</span>
                      {c.href ? <a href={c.href}>{c.value}</a> : <span>{c.value}</span>}
                    </li>
                  ))}
                </ul>
                <button className="closing__more meta lift" onClick={() => travelTo('/lien-he')}>
                  LIÊN HỆ <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Where you are in the house. */}
      <nav className="overview__marks" aria-label="Các phần">
        {scenes.map((scene, i) => (
          <button
            key={scene.key}
            className="overview__mark"
            data-here={i === at}
            onClick={() => go(i)}
            aria-label={scene.set?.title ?? (scene.kind === 'opening' ? 'Mở đầu' : 'Liên hệ')}
          />
        ))}
      </nav>
    </div>
  )
}
