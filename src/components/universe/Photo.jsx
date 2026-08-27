import { useCallback, useEffect, useRef, useState } from 'react'
import { useImageReady } from '../../hooks/useImageReady.js'

/**
 * One photograph, thrown out of a galaxy.
 *
 * Its position, size and opacity all belong to the overview's animation
 * frame, not to React — this component renders once and then holds still
 * while the loop writes to its style. It carries two files: the 1000px tile
 * it normally shows, and the 2400px original once it has grown past that.
 */
export function Photo({ image, index, register, onOpen, priority }) {
  const el = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hiRes, setHiRes] = useState(false)
  const tile = useImageReady()
  const full = useImageReady()

  const requestHiRes = useCallback((want) => {
    setHiRes((current) => (current === want ? current : want || current))
  }, [])

  useEffect(() => {
    register(index, { el: el.current, setHiRes: requestHiRes })
    return () => register(index, null)
  }, [index, register, requestHiRes])

  // The first few frames of each galaxy load at once so a galaxy never opens
  // onto empty rectangles; the rest wait until they are nearly on screen.
  useEffect(() => {
    if (visible) return
    if (priority) { setVisible(true); return }
    const node = el.current
    if (!node) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { rootMargin: '300px' },
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
      style={{ backgroundImage: `url(${image.lqip})`, visibility: 'hidden' }}
      onClick={onOpen}
      aria-label={`${image.setTitle} — ảnh ${image.number}`}
    >
      {visible && (
        <img
          className="photo__tile"
          src={image.tile}
          alt={`${image.setTitle} — ${image.setSubtitle}`}
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
          src={image.full}
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
