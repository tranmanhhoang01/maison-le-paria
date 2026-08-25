import { useCallback, useEffect, useRef, useState } from 'react'
import { photos, photoIndex } from '../../data/projects.js'
import { closeViewer, openViewer, useExperience } from '../../store/experience.js'

/**
 * The photograph, full size. One click away from anywhere in the universe.
 *
 * Each frame is its own layer so the outgoing image is still on screen while
 * the incoming one decodes — you never see the black in between.
 */
export function Viewer() {
  const viewer = useExperience((s) => s.viewer)
  const [layers, setLayers] = useState([])
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef(null)
  const drag = useRef(null)

  const photo = viewer?.photo ?? null
  const index = photo ? photoIndex(photo) : -1

  const step = useCallback((delta) => {
    if (index < 0) return
    openViewer(photos[(index + delta + photos.length) % photos.length])
  }, [index])

  useEffect(() => {
    if (!photo) { setLayers([]); return }
    setLayers((prev) => {
      if (prev[prev.length - 1]?.photo.id === photo.id) return prev
      return [...prev.slice(-1), { photo, key: `${photo.id}-${performance.now()}`, loaded: false }]
    })
  }, [photo])

  // The two neighbours are fetched quietly, so arrow keys feel instant.
  useEffect(() => {
    if (index < 0) return
    for (const d of [1, -1]) {
      const img = new Image()
      img.decoding = 'async'
      img.src = photos[(index + d + photos.length) % photos.length].full
    }
  }, [index])

  /**
   * Marking a layer loaded has to be idempotent. It is called from `onLoad`
   * *and* from a ref — the ref because `onLoad` never fires for an image the
   * browser already holds, and a ref callback runs on every render. Without
   * the early bail below, each render would produce a new array, which would
   * cause another render, for ever: the viewer would open onto a frozen page.
   */
  const markLoaded = useCallback((key) => {
    setLayers((prev) => {
      const target = prev.find((l) => l.key === key)
      if (!target || target.loaded) return prev
      const next = prev.map((l) => (l.key === key ? { ...l, loaded: true } : l))
      return next[next.length - 1]?.key === key ? next.slice(-1) : next
    })
  }, [])

  const nudge = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 2600)
  }, [])

  useEffect(() => {
    if (!photo) return
    nudge()
    const onKey = (e) => {
      if (e.key === 'Escape') closeViewer()
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); nudge() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); nudge() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); clearTimeout(idleTimer.current) }
  }, [photo, step, nudge])

  if (!photo) return null

  const onPointerDown = (e) => { drag.current = { x: e.clientX, t: performance.now() } }
  const onPointerUp = (e) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const quick = performance.now() - drag.current.t < 600
    drag.current = null
    if (Math.abs(dx) > (quick ? 40 : 110)) { step(dx < 0 ? 1 : -1); nudge() }
  }

  return (
    <div
      className="viewer"
      data-idle={idle}
      onPointerMove={nudge}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.setTitle} — ảnh ${photo.number}`}
    >
      <div className="viewer__frame">
        {layers.map((layer) => (
          <figure
            key={layer.key}
            className="viewer__layer"
            data-loaded={layer.loaded}
            style={{ '--ratio': layer.photo.ratio }}
          >
            {/* The 1000px tile is already in the browser's cache — it was on
                screen a moment ago — so the photograph appears instantly and
                merely sharpens when the full file lands. No black gap, and
                nothing blurred at any point. */}
            <img className="viewer__preview" src={layer.photo.tile} alt="" aria-hidden="true" />
            <img
              className="viewer__img"
              ref={(el) => { if (el?.complete && el.naturalWidth > 0) markLoaded(layer.key) }}
              src={layer.photo.full}
              alt={`${layer.photo.setTitle} — ${layer.photo.setSubtitle}`}
              decoding="async"
              draggable="false"
              onLoad={() => markLoaded(layer.key)}
              onError={() => markLoaded(layer.key)}
            />
          </figure>
        ))}
      </div>

      <div className="viewer__ui">
        <div className="viewer__id">
          <span className="serif">{photo.setTitle}</span>
          <span className="micro">{photo.setSubtitle}</span>
        </div>
        <div className="viewer__count meta">
          {String(index + 1).padStart(2, '0')}
          <span className="viewer__slash">/</span>
          {String(photos.length).padStart(2, '0')}
        </div>
        <button className="viewer__nav viewer__nav--prev" onClick={() => { step(-1); nudge() }} aria-label="Ảnh trước">
          <span className="micro">TRƯỚC</span>
        </button>
        <button className="viewer__nav viewer__nav--next" onClick={() => { step(1); nudge() }} aria-label="Ảnh sau">
          <span className="micro">SAU</span>
        </button>
        <button className="viewer__close meta" onClick={closeViewer} aria-label="Đóng">ĐÓNG ✕</button>
      </div>
    </div>
  )
}
