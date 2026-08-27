import { mulberry32 } from './math.js'

/**
 * Where the galaxies hang in space, and where each photograph flies to when
 * its galaxy opens.
 *
 * Everything has a z. Space with no depth is wallpaper, so galaxies sit at
 * different distances, lean at different angles, and photographs travel
 * toward the viewer rather than merely growing.
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** Distance from the eye to the plane where scale is 1:1. */
export const FOCAL = 7

/** Perspective factor for something z units behind that plane. */
export const persp = (z) => FOCAL / (FOCAL + z)

export function buildCosmos(sets, { compact = false } = {}) {
  const rand = mulberry32(20260826)
  const orbit = compact ? 2.4 : 3.3

  return sets.map((set, i) => {
    const angle = (i / sets.length) * Math.PI * 2 - Math.PI / 2 + 0.35
    const radius = set.images.length > 14 ? 1.35 : 1.05

    // Each galaxy at its own distance — the near one reads large and moves a
    // lot when you drag, the far one barely stirs.
    const z = -0.9 + rand() * 2.8

    const place = {
      x: Math.cos(angle) * orbit * (compact ? 0.74 : 1),
      y: Math.sin(angle) * orbit * (compact ? 0.9 : 0.58),
      z,
      radius,
      // A galaxy seen from directly above is a circle, and nothing in the sky
      // is that obliging. Each one leans, and each one leans differently.
      tilt: (24 + rand() * 48) * (Math.PI / 180),
      roll: rand() * Math.PI * 2,
      spin: (i % 2 === 0 ? 1 : -1) * (0.012 + rand() * 0.010),
    }

    const burst = layoutBurst(pick(set.images, compact ? 6 : 8), place, rand, compact)
    // How far this galaxy's photographs reach when fully out — the overview
    // uses it to decide when the pointer has really left.
    const reach = Math.max(...burst.map((b) => Math.hypot(b.x, b.y) + Math.max(b.w, b.h) / 2))
    return { ...set, place, burst, reach }
  })
}

/**
 * A galaxy shows a handful of its work, not all of it.
 *
 * Twenty-four photographs cannot come out of one core and still be big enough
 * to look at — they either overlap, or fly off the screen, or land on the
 * next galaxy along. Eight can. So the overview takes an evenly spaced sample
 * and the library keeps the whole archive.
 */
function pick(images, most) {
  if (images.length <= most) return images
  const step = images.length / most
  return Array.from({ length: most }, (_, i) => images[Math.floor(i * step)])
}

/**
 * The ring a galaxy's photographs settle into.
 *
 * Seeded on a golden-angle spiral, then relaxed until no two frames overlap —
 * photographs stacked on each other are photographs you cannot look at, which
 * defeats the point of bringing them out at all.
 */
function layoutBurst(images, place, rand, compact) {
  const items = images.map((image, n) => {
    const a = n * GOLDEN + place.roll
    const t = (n + 0.6) / images.length
    const dist = place.radius * 1.0 + Math.sqrt(t) * (compact ? 0.95 : 0.9)
    const h = (1.12 + rand() * 0.26) * (compact ? 0.66 : 1)
    return {
      image,
      x: Math.cos(a) * dist,
      y: Math.sin(a) * dist * 0.82,
      // Resting depth: slightly in front of the galaxy, so they read as having
      // come out of it toward you.
      z: -0.45 - rand() * 0.5,
      w: h * (image.ratio ?? 0.75),
      h,
      spinOut: (rand() - 0.5) * 0.3,
    }
  })

  relax(items)

  // One at a time. The order is the order they were shot in, and each frame
  // waits until the one before it is nearly home.
  const last = 0.78
  items.forEach((item, n) => {
    item.delay = images.length > 1 ? (n / (images.length - 1)) * last : 0
  })

  return items
}

/** Push overlapping frames apart. A few dozen passes is plenty at this size. */
function relax(items, passes = 160) {
  const PAD = 0.12
  for (let pass = 0; pass < passes; pass++) {
    let moved = 0
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const minX = (a.w + b.w) / 2 + PAD
        const minY = (a.h + b.h) / 2 + PAD
        const overX = minX - Math.abs(dx)
        const overY = minY - Math.abs(dy)
        if (overX <= 0 || overY <= 0) continue

        // Separate along whichever axis needs less correction, so the ring
        // stays a ring instead of unravelling.
        if (overX / minX < overY / minY) {
          const push = (overX / 2) * (dx < 0 ? -1 : 1)
          a.x -= push; b.x += push
        } else {
          const push = (overY / 2) * (dy < 0 ? -1 : 1)
          a.y -= push; b.y += push
        }
        moved++
      }
    }
    if (!moved) break
  }
}
