import { mulberry32 } from './math.js'

/**
 * Lays every photograph out on one infinite plane.
 *
 * Two rules the Apple Watch grid gets right and a masonry grid does not:
 * the cluster has a centre and an edge, and nothing is aligned to a column.
 * So: seed the positions on a golden-angle spiral (dense in the middle,
 * loosening outward, no rows), then relax the boxes apart until nothing
 * overlaps — with enough breathing room that a magnified tile still doesn't
 * touch its neighbours.
 *
 * Photographs keep their own proportions. Each is given an *area*, not a
 * width — so a panorama and a portrait can carry equal weight in the field
 * without either being cropped.
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Room left around every tile so magnification never causes a collision. */
const PADDING = 0.13

export function buildConstellation(photos, { spread = 1 } = {}) {
  const rand = mulberry32(20260824)

  const items = photos.map((photo, i) => {
    // Rhythm: most frames sit around the base size, every so often one is
    // given real presence. Without this the field reads as wallpaper.
    const beat = i % 9 === 4 ? 1.75 : i % 5 === 2 ? 1.28 : 1
    const jitter = 0.86 + rand() * 0.34
    const area = beat * jitter

    const ratio = photo.ratio ?? 0.75
    const w = Math.sqrt(area * ratio)
    const h = Math.sqrt(area / ratio)

    // The spiral starts *tighter* than the frames can actually sit. Relaxation
    // then pushes them apart to exactly touching — which packs the cluster as
    // densely as its own contents allow, instead of leaving the gaps that a
    // spiral spaced by guesswork would.
    const t = i + 0.5
    const radius = Math.sqrt(t) * 0.6 * spread
    const angle = t * GOLDEN_ANGLE

    return {
      photo,
      w, h,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.82,   // slightly wide: screens are wide
      weight: beat,
    }
  })

  relax(items)
  return centre(items)
}

/** Push overlapping boxes apart. Converges in well under 100 passes at n≈50. */
function relax(items, passes = 140) {
  for (let pass = 0; pass < passes; pass++) {
    let moved = 0
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const minX = (a.w + b.w) / 2 + PADDING
        const minY = (a.h + b.h) / 2 + PADDING
        const overlapX = minX - Math.abs(dx)
        const overlapY = minY - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue

        // Separate along whichever axis needs the smaller correction, so the
        // cluster stays compact instead of exploding outward.
        if (overlapX / minX < overlapY / minY) {
          const push = (overlapX / 2) * (dx < 0 ? -1 : 1)
          a.x -= push; b.x += push
        } else {
          const push = (overlapY / 2) * (dy < 0 ? -1 : 1)
          a.y -= push; b.y += push
        }
        moved++
      }
    }
    if (!moved) break
  }
}

function centre(items) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const it of items) {
    minX = Math.min(minX, it.x - it.w / 2)
    maxX = Math.max(maxX, it.x + it.w / 2)
    minY = Math.min(minY, it.y - it.h / 2)
    maxY = Math.max(maxY, it.y + it.h / 2)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  for (const it of items) { it.x -= cx; it.y -= cy }

  return {
    items,
    width: maxX - minX,
    height: maxY - minY,
  }
}
