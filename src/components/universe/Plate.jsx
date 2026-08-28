import { useImageReady } from '../../hooks/useImageReady.js'

/**
 * One photograph inside a chapter. Its place in the composition comes from
 * CSS, not from a script — three frames on a designed grid, not three frames
 * positioned by arithmetic.
 */
export function Plate({ image, slot, onOpen }) {
  const tile = useImageReady()

  return (
    <button
      className="plate"
      data-slot={slot}
      data-loaded={tile.ready}
      data-instant={tile.instant}
      style={{ backgroundImage: `url(${image.lqip})`, aspectRatio: image.ratio }}
      onClick={onOpen}
      aria-label={`${image.setTitle} — ảnh ${image.number}`}
    >
      <img
        src={image.tile}
        alt={`${image.setTitle} — ${image.setSubtitle}`}
        loading="lazy"
        decoding="async"
        draggable="false"
        ref={tile.catchCached}
        onLoad={tile.markReady}
      />
    </button>
  )
}
