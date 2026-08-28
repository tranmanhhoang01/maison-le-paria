import { useEffect, useRef, useState } from 'react'
import { useImageReady } from '../../hooks/useImageReady.js'

/**
 * One photograph in the current.
 *
 * Position, size, lean and opacity all belong to the overview's animation
 * frame — this renders once and then holds still while the loop writes to its
 * style. Only the 1000px tile is ever loaded here: even the near band draws
 * under 900 device pixels wide, so the larger files would be weight without
 * a difference. The viewer is where the full file belongs.
 */
export function Photo({ image, index, register, onOpen, priority }) {
  const el = useRef(null)
  const [visible, setVisible] = useState(Boolean(priority))
  const tile = useImageReady()

  useEffect(() => {
    register(index, el.current)
    return () => register(index, null)
  }, [index, register])

  // Frames beyond the first screenful wait until the current brings them near.
  useEffect(() => {
    if (visible) return
    const node = el.current
    if (!node) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { rootMargin: '400px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [visible])

  return (
    <button
      ref={el}
      className="photo"
      data-loaded={tile.ready}
      data-instant={tile.instant}
      style={{ backgroundImage: `url(${image.lqip})`, visibility: 'hidden' }}
      onClick={onOpen}
      aria-label={`${image.setTitle} — ảnh ${image.number}`}
    >
      {visible && (
        <img
          src={image.tile}
          alt={`${image.setTitle} — ${image.setSubtitle}`}
          decoding="async"
          draggable="false"
          fetchpriority={priority ? 'high' : 'auto'}
          ref={tile.catchCached}
          onLoad={tile.markReady}
        />
      )}
    </button>
  )
}
