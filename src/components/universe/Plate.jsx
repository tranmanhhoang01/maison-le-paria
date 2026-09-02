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
 *
 * The 1000px tile was never enough here. The lead frame draws about 40% of a
 * wide screen — over 1200 device pixels on a retina display — and a portrait
 * tile is only 667 wide, so it was being blown up half again its size. It has
 * a srcSet now and the browser picks.
 */
export function Plate({ image, slot, onOpen, style, src, eager = false }) {
  const tile = useImageReady()

  return (
    <button
      className="plate"
      data-slot={slot}
      data-loaded={tile.ready}
      data-instant={tile.instant}
      style={{ backgroundImage: `url(${image.lqip})`, '--ratio': image.ratio, ...style }}
      onClick={onOpen}
      aria-label={`${image.setTitle} — ảnh ${image.number}`}
    >
      <img
        src={src ?? image.wide}
        {...(src ? {} : {
          srcSet: image.srcSet,
          sizes: slot === 0
            ? '(max-width: 860px) 100vw, 44vw'
            : '(max-width: 860px) 50vw, 24vw',
        })}
        alt={`${image.setTitle} — ${image.setSubtitle}`}
        /* Chương kế bên phải sẵn sàng **trước** khi người xem vuốt tới. Giải mã
           một tấm ảnh giữa chừng một cử chỉ là mất vài khung hình, và đó chính
           là cái khựng. */
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable="false"
        ref={tile.catchCached}
        onLoad={tile.markReady}
      />
    </button>
  )
}
