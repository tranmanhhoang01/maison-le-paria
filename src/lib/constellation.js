import { mulberry32 } from './math.js'

/**
 * Where the galaxies sit, and where each photograph flies to when its galaxy
 * opens.
 *
 * Everything is in world units — one unit is a few hundred pixels depending
 * on zoom — and everything is deterministic, because a field of stars that
 * rearranged itself on every reload would stop being a place.
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export function buildCosmos(sets, { compact = false } = {}) {
  const rand = mulberry32(20260826)
  const orbit = compact ? 2.2 : 2.9

  return sets.map((set, i) => {
    // Galaxies on a wide ring, turned so no two sit directly above each other.
    const angle = (i / sets.length) * Math.PI * 2 - Math.PI / 2 + 0.35
    // Sized so three of them share a screen without touching, and so the
    // largest body of work reads as the largest galaxy.
    const radius = set.images.length > 14 ? 1.3 : 1.02

    const place = {
      x: Math.cos(angle) * orbit * (compact ? 0.72 : 1),
      y: Math.sin(angle) * orbit * (compact ? 0.92 : 0.55),
      radius,
      spin: (i % 2 === 0 ? 1 : -1) * (0.014 + rand() * 0.010),
    }

    // Where the photographs go when the galaxy opens: a loose spiral thrown
    // outward from the core, so they read as streaming out rather than
    // arriving in a tidy circle.
    const burst = set.images.map((image, n) => {
      const a = n * GOLDEN + i * 1.7
      const t = (n + 1) / set.images.length
      const dist = radius * (1.2 + t * 0.95) + rand() * 0.34
      const height = (1.15 + rand() * 0.6) * (compact ? 0.76 : 1)
      return {
        image,
        angle: a,
        x: Math.cos(a) * dist,
        y: Math.sin(a) * dist * 0.78,
        w: height * (image.ratio ?? 0.75),
        h: height,
        // Staggered so they leave the core in a stream, not all at once.
        delay: (n / set.images.length) * 0.42,
        spinOut: (rand() - 0.5) * 0.24,
      }
    })

    return { ...set, place, burst }
  })
}
