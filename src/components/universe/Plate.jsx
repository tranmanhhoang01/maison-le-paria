import { useImageReady } from '../../hooks/useImageReady.js'

/**
 * One photograph inside a chapter.
 *
 * It carries its own aspect ratio and takes its height from the chapter's
 * hang; the width follows from the two. That is what keeps a standing
 * portrait standing and a landscape lying down, without a script measuring
 * anything — and if three wide frames ask for more room than the screen has,
 * the flex row shrinks them and the crop stays gentle rather than the layout
 * breaking.
 */
export function Plate({ image, slot, onOpen }) {
  const tile = useImageReady()

  return (
    <button
      className="plate"
      data-slot={slot}
      data-loaded={tile.ready}
      data-instant={tile.instant}
      style={{ backgroundImage: `url(${image.lqip})`, '--ratio': image.ratio }}
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
