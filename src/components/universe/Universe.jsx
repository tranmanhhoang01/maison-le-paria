import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildScenes } from '../../lib/scenes.js'
import { clamp } from '../../lib/math.js'
import { openViewer } from '../../store/experience.js'
import { navigate } from '../../lib/router.js'
import { Plate } from './Plate.jsx'

/**
 * The overview: the house in five screens.
 *
 * An opening that says who this is, one chapter per series showing three
 * frames apiece, and a closing that says how to reach them. It is not a
 * gallery — the library is the gallery, and for several drafts this page was
 * a second one, which is why it never had anything to say.
 *
 * One screen at a time, moved by the wheel, a drag, or the arrow keys. The
 * whole thing is a CSS transition on a single element: no animation loop, no
 * per-frame writes, nothing to fall out of sync.
 */
export function Universe({ sets, active = true }) {
  const scenes = useMemo(() => buildScenes(sets), [sets])
  const [at, setAt] = useState(0)
  const wheel = useRef(0)
  const drag = useRef(null)

  const go = useCallback((i) => setAt((cur) => clamp(i, 0, scenes.length - 1)), [scenes.length])

  useEffect(() => {
    if (!active) return

    const onWheel = (e) => {
      e.preventDefault()
      wheel.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (wheel.current > 110) { wheel.current = 0; setAt((c) => clamp(c + 1, 0, scenes.length - 1)) }
      if (wheel.current < -110) { wheel.current = 0; setAt((c) => clamp(c - 1, 0, scenes.length - 1)) }
    }

    const onKey = (e) => {
      const moves = { ArrowRight: 1, PageDown: 1, ArrowDown: 1, ArrowLeft: -1, PageUp: -1, ArrowUp: -1 }
      if (e.key === 'Home') { e.preventDefault(); setAt(0); return }
      if (e.key === 'End') { e.preventDefault(); setAt(scenes.length - 1); return }
      const move = moves[e.key]
      if (move === undefined) return
      e.preventDefault()
      setAt((c) => clamp(c + move, 0, scenes.length - 1))
    }

    const onDown = (e) => { if (e.button === 0) drag.current = { x: e.clientX, moved: false } }
    const onMove = (e) => {
      if (!drag.current) return
      if (Math.abs(e.clientX - drag.current.x) > 8) drag.current.moved = true
    }
    const onUp = (e) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x
      drag.current = null
      if (Math.abs(dx) > 90) setAt((c) => clamp(c + (dx < 0 ? 1 : -1), 0, scenes.length - 1))
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [active, scenes.length])

  // A click that ended a drag is not a click on a photograph.
  const opened = (image) => { if (!drag.current?.moved) openViewer(image) }

  return (
    <div className="overview" {...(active ? {} : { inert: '', 'aria-hidden': 'true' })}>
      <div className="overview__track" style={{ transform: `translate3d(${-at * 100}vw, 0, 0)` }}>
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
                    style={{ backgroundImage: `url(${scene.backdrop.tile})` }}
                    aria-hidden="true"
                  />
                )}
                <div className="scene__centre">
                  <h1 className="scene__name serif lift">
                    <span>MAISON</span><span>LE PARIA</span>
                  </h1>
                  <p className="scene__tagline meta lift">{scene.tagline}</p>
                  <p className="scene__line lift">{scene.line}</p>
                </div>
              </>
            )}

            {scene.kind === 'series' && (
              <div className="series-scene">
                <header className="series-scene__text">
                  <span className="series-scene__num micro lift">{scene.set.number} — {scene.set.category ?? scene.set.subtitle}</span>
                  <h2 className="series-scene__title serif lift">{scene.set.title}</h2>
                  <p className="series-scene__note lift">{scene.set.description}</p>
                  <p className="series-scene__meta micro lift">
                    {scene.set.location} · {scene.set.year} · {String(scene.set.images.length).padStart(2, '0')} ảnh
                  </p>
                  <button className="series-scene__more meta lift" onClick={() => navigate('/thu-vien')}>
                    XEM CẢ BỘ <span aria-hidden="true">→</span>
                  </button>
                </header>

                <div className="series-scene__plates">
                  {scene.plates.map((image, n) => (
                    <Plate key={image.id} image={image} slot={n} onOpen={() => opened(image)} />
                  ))}
                </div>
              </div>
            )}

            {scene.kind === 'closing' && (
              <div className="scene__centre">
                <h2 className="scene__name serif lift">{scene.headline}</h2>
                <p className="scene__line lift">{scene.note}</p>
                <ul className="closing__channels lift">
                  {scene.channels.map((c) => (
                    <li key={c.label}>
                      <span className="micro">{c.label}</span>
                      {c.href ? <a href={c.href}>{c.value}</a> : <span>{c.value}</span>}
                    </li>
                  ))}
                </ul>
                <button className="closing__more meta lift" onClick={() => navigate('/lien-he')}>
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
