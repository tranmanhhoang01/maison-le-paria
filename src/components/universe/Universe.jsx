import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildScenes } from '../../lib/scenes.js'
import { clamp } from '../../lib/math.js'
import { openViewer, useExperience } from '../../store/experience.js'
import { travelTo } from '../../lib/transition.js'
import { PlateCluster } from './PlateCluster.jsx'
import { Seal } from '../chrome/Seal.jsx'
import { Nghe, Clouds, CloudField, Cloud } from '../chrome/Ornament.jsx'

/**
 * The overview: the house in five screens.
 *
 * An opening that says who this is, one chapter per series showing three
 * frames apiece, and a closing that says how to reach them. It is not a
 * gallery — the library is the gallery, and for several drafts this page was
 * a second one, which is why it never had anything to say.
 *
 * Movement is one CSS transition on one element. There is no animation loop:
 * during a gesture the track follows the hand through a single style write
 * per frame, and when the gesture ends the transition takes over.
 */

/** How far a gesture must travel before it counts as a page turn. */
const TURN = 0.12          // of the viewport
const FLICK = 0.45         // px per ms — a fast, short swipe still turns
const FLICK_MIN = 40       // ...but a twitch is not a swipe
/**
 * The wheel turns the page. One swipe, one chapter, and the movement people
 * see is the transition — not the gesture.
 *
 * Two earlier versions got this wrong in opposite directions. The first
 * banked deltas until they crossed a threshold and then jumped: push, nothing,
 * lurch. The second let the house follow the fingers and decided at the end of
 * the gesture — but a macOS trackpad keeps sending inertia for a second or two
 * after the fingers leave the glass, so "the end of the gesture" arrived two
 * seconds late and the house sat frozen against its limit until it did.
 *
 * A wheel is not a finger on the thing itself: there is nothing under the hand
 * to follow. So it does not follow. The first real push of a gesture turns the
 * page immediately, the transition does the moving, and every event after that
 * — the rest of the push, and all of the inertia — is swallowed until the
 * wheel has been quiet long enough to count as a new gesture.
 */
const WHEEL_TRIGGER = 24   // px of a gesture before it counts — one push, no more
const WHEEL_GAP = 140      // ms of quiet that starts a new gesture's reckoning
const WHEEL_TAIL = 90      // ms of quiet demanded before a new gesture counts
const WHEEL_SETTLE = 360   // ms to let the house arrive before listening again
const EDGE_PULL = 0.28     // resistance at the two ends of a drag

/**
 * One chapter, and only re-rendered when it becomes the current one.
 *
 * This memo is not a micro-optimisation. Turning a page changes one number,
 * and without it React re-renders all five screens — every photograph, every
 * cloud, every measured cluster — in the same frame the slide begins. That is
 * a few milliseconds of work landing exactly where there is none to spare,
 * and it is felt as a catch at the start of every turn.
 */
const SceneView = memo(function SceneView({ scene, index, here, compact, onOpen }) {
  return (
    <section className="scene" data-kind={scene.kind} data-here={here} aria-hidden={!here}>
      {scene.kind === 'opening' && (
        <>
          {scene.backdrop && (
            <div
              className="scene__backdrop"
              style={{
                // The full file, not the middle one: this photograph is the
                // first thing anyone sees and it covers the whole screen.
                backgroundImage: `url(${scene.backdrop.full}), url(${scene.backdrop.lqip})`,
                opacity: scene.veil,
              }}
              aria-hidden="true"
            />
          )}
          <div className="scene__centre">
            {/* Một đôi nghê chầu hai bên con triện — thế đứng của chúng ở
                cổng đình, hai con quay vào giữa. */}
            <div className="crest lift">
              <Nghe facing="right" />
              <Seal />
              <Nghe facing="left" />
            </div>
            <h1 className="scene__name serif lift">
              <span>MAISON</span><span>LE PARIA</span>
            </h1>
            <p className="scene__tagline meta lift">{scene.tagline}</p>
            <p className="scene__line lift">{scene.line}</p>
          </div>
        </>
      )}

      {scene.kind === 'series' && (
        <div className="series-scene" data-hang={scene.hang}>
          <CloudField seed={index + 3} count={3} />
          <header className="series-scene__text">
            {/* Vân chìm ngay sau tên bộ và câu chuyện của nó. */}
            <Cloud className="cloud--sunk" facing="right" />
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

          <PlateCluster plates={scene.plates} compact={compact} onOpen={onOpen} />
        </div>
      )}

      {scene.kind === 'closing' && (
        <div className="scene__centre">
          <CloudField seed={91} count={4} className="cloud-field--wide" />
          <h2 className="scene__name serif lift">{scene.headline}</h2>
          <Clouds className="clouds--short scene__ornament lift" />
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
  )
})

export function Universe({ sets, compact = false, active = true }) {
  const scenes = useMemo(() => buildScenes(sets), [sets])
  const [at, setAt] = useState(0)
  const track = useRef(null)
  const pending = useRef(0)
  const span = useRef(typeof window === 'undefined' ? 0 : window.innerWidth)
  const atDoor = useExperience((s) => s.atDoor)
  const wheel = useRef({ sum: 0, last: 0, quiet: 0, settled: 0 })
  const drag = useRef(null)

  const go = useCallback(
    (i) => setAt((cur) => clamp(typeof i === 'function' ? i(cur) : i, 0, scenes.length - 1)),
    [scenes.length],
  )

  /**
   * The track's transform is written here rather than handed to React as a
   * style prop: a gesture writes to the same property between renders, and
   * two owners for one property is how a page starts stuttering.
   *
   * In pixels, not `calc(-Nvw + Xpx)`. The browser has to parse and resolve a
   * calc on every write, and there are a hundred and twenty of them a second.
   */
  const settle = useCallback((offset = 0) => {
    const el = track.current
    if (!el) return
    el.style.transform = `translate3d(${-at * span.current + offset}px, 0, 0)`
  }, [at])

  useEffect(() => { settle() }, [settle])

  // The name in the corner, or Tổng quan in the menu: back to the first screen.
  useEffect(() => { setAt(0) }, [atDoor])

  useEffect(() => {
    const onResize = () => { span.current = window.innerWidth; settle() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [settle])

  /**
   * A trackpad and a 120Hz screen both deliver events faster than the screen
   * can draw them, and every write costs a style recalculation. Fold them
   * into one write per frame — the eye cannot see more than that anyway.
   */
  const follow = useCallback((read) => {
    if (pending.current) return
    pending.current = requestAnimationFrame(() => {
      pending.current = 0
      const offset = read()
      if (offset !== null) settle(offset)
    })
  }, [settle])

  const hold = (on) => {
    const el = track.current
    if (!el) return
    if (on) el.setAttribute('data-dragging', 'true')
    else el.removeAttribute('data-dragging')
  }

  useEffect(() => {
    if (!active) return

    const onWheel = (e) => {
      e.preventDefault()
      const w = wheel.current
      const now = performance.now()

      /* The tail of the last gesture — the rest of the push, and the inertia
         the trackpad keeps sending after the fingers left. Swallow it, and
         keep pushing the quiet period out, until the wheel really stops. */
      if (now < w.quiet || now < w.settled) {
        w.quiet = now + WHEEL_TAIL
        return
      }

      // A long enough silence means this is a new gesture, not the same one.
      if (now - w.last > WHEEL_GAP) w.sum = 0
      w.last = now
      w.sum += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      // Small enough to fire on the first real push; large enough that a
      // stray pixel of jitter is not a page turn.
      if (Math.abs(w.sum) < WHEEL_TRIGGER) return

      const dir = w.sum > 0 ? 1 : -1
      w.sum = 0
      if ((at === 0 && dir < 0) || (at === scenes.length - 1 && dir > 0)) return
      w.quiet = now + WHEEL_TAIL
      w.settled = now + WHEEL_SETTLE
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
        if (Math.abs(e.clientY - d.y) > 14) drag.current = null
        return
      }
      if (!d.moved) { d.moved = true; hold(true) }
      // Resistance at the two ends, so the house feels bounded rather than broken.
      const edge = (at === 0 && dx > 0) || (at === scenes.length - 1 && dx < 0)
      d.dx = edge ? dx * EDGE_PULL : dx
      follow(() => (drag.current ? drag.current.dx : null))
    }

    const onUp = (e) => {
      const d = drag.current
      drag.current = null
      if (pending.current) { cancelAnimationFrame(pending.current); pending.current = 0 }
      if (!d) return
      hold(false)
      if (!d.moved) return
      const dx = e.clientX - d.x
      const speed = Math.abs(dx) / Math.max(1, performance.now() - d.t)
      const far = Math.abs(dx) > window.innerWidth * TURN
        || (speed > FLICK && Math.abs(dx) > FLICK_MIN)
      if (far) { go((c) => c + (dx < 0 ? 1 : -1)); return }
      settle()   // it did not travel far enough — slide back to where it was
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      /* Chuyển chương ngay giữa một cú kéo dở sẽ để lại `data-dragging` — và
         transition tắt vĩnh viễn từ đó. Dọn sạch mỗi lần gỡ. */
      wheel.current.sum = 0
      hold(false)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [active, scenes.length, go, settle, follow, at])

  // A click that ended a drag is not a click on a photograph.
  const opened = useCallback((image) => {
    if (!drag.current?.moved) openViewer(image)
  }, [])

  return (
    <div className="overview sheet" {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      <div className="overview__track" ref={track}>
        {scenes.map((scene, i) => (
          <SceneView
            key={scene.key}
            scene={scene}
            index={i}
            here={i === at}
            compact={compact}
            onOpen={opened}
          />
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
