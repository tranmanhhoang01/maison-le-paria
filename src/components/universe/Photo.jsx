import { useCallback, useEffect, useRef, useState } from 'react'
import { useImageReady } from '../../hooks/useImageReady.js'

/**
 * One photograph hanging in the field.
 *
 * It carries two files: the 1000px tile it normally shows, and — only once
 * the zoom has grown it past that — the 2400px original, faded in over the
 * top. That is the whole trick behind zooming in without anything going soft:
 * a two-step resolution pyramid, the same idea a map uses.
 *
 * The element's transform belongs to Universe's animation frame, not to
 * React. Nothing here re-renders while you zoom or move the pointer.
 */
export function Photo({ item, unit, index, register, onOpen, priority }) {
  const el = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hiRes, setHiRes] = useState(false)
  const tile = useImageReady()
  const full = useImageReady()
  const { photo } = item

  // Called from the animation loop every frame; only crossing the threshold
  // is allowed to reach React.
  const requestHiRes = useCallback((want) => {
    setHiRes((current) => (current === want ? current : want || current))
  }, [])

  useEffect(() => {
    register(index, { el: el.current, setHiRes: requestHiRes })
    return () => register(index, null)
  }, [index, register, requestHiRes])

  // Frames near the middle of the cluster are fetched at once; the rest wait
  // until they approach the screen. Otherwise the browser opens fifty requests
  // in parallel and the photograph you are actually looking at arrives last.
  useEffect(() => {
    if (visible) return
    if (priority) { setVisible(true); return }
    const node = el.current
    if (!node) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { rootMargin: '450px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [visible, priority])

  return (
    <button
      ref={el}
      className="photo"
      data-loaded={tile.ready}
      data-instant={tile.instant}
      data-hires={full.ready}
      style={{
        left: `${item.x * unit}px`,
        top: `${item.y * unit}px`,
        width: `${item.w * unit}px`,
        height: `${item.h * unit}px`,
        backgroundImage: `url(${photo.lqip})`,
      }}
      onClick={onOpen}
      aria-label={`${photo.setTitle} — ảnh ${photo.number}`}
    >
      {visible && (
        <img
          className="photo__tile"
          src={photo.tile}
          alt={`${photo.setTitle} — ${photo.setSubtitle}`}
          decoding="async"
          draggable="false"
          fetchpriority={priority ? 'high' : 'auto'}
          ref={tile.catchCached}
          onLoad={tile.markReady}
        />
      )}
      {hiRes && (
        <img
          className="photo__full"
          src={photo.full}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable="false"
          ref={full.catchCached}
          onLoad={full.markReady}
        />
      )}
    </button>
  )
}
