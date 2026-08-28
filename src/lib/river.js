import { mulberry32 } from './math.js'

/**
 * The overview is one horizontal sequence — a magazine spread unrolled.
 *
 * The version before this one stacked the photographs into three drifting
 * bands. It looked like three filmstrips: every frame belonged to its lane
 * and to nothing else, and size was decided by which lane you were in rather
 * than by the composition. Tiers, not a picture.
 *
 * So: one line. Size and height vary photograph by photograph, on a written
 * rhythm rather than at random, with enough air between them that each one
 * can be looked at. The eye travels along a single path and the variation
 * does the work that layering was failing to do.
 */

/**
 * The cadence. Read it as a bar of music: a large frame, two quiet ones, a
 * medium, and so on. It repeats, but never lands the same way twice because
 * the archive keeps feeding it different shapes.
 *
 *   size — height as a fraction of the viewport
 *   y    — where its centre sits, 0 top … 1 bottom
 */
const RHYTHM = [
  { size: 0.74, y: 0.52 },   // hero
  { size: 0.30, y: 0.26 },
  { size: 0.46, y: 0.63 },
  { size: 0.28, y: 0.72 },
  { size: 0.58, y: 0.42 },
  { size: 0.34, y: 0.70 },
  { size: 0.70, y: 0.55 },
  { size: 0.26, y: 0.28 },
  { size: 0.44, y: 0.36 },
  { size: 0.32, y: 0.66 },
]

const COMPACT_RHYTHM = [
  { size: 0.52, y: 0.50 },
  { size: 0.26, y: 0.28 },
  { size: 0.38, y: 0.66 },
  { size: 0.24, y: 0.72 },
  { size: 0.46, y: 0.44 },
  { size: 0.30, y: 0.30 },
]

/** Air between frames, as a fraction of the viewport height. */
const GAP = 0.085
const COMPACT_GAP = 0.06

export function buildRiver(photos, { compact = false, viewport = 1440 } = {}) {
  const rand = mulberry32(20260827)
  const rhythm = compact ? COMPACT_RHYTHM : RHYTHM
  const gap = compact ? COMPACT_GAP : GAP

  // Repeat the archive until the line is longer than two screens, so the loop
  // never shows its seam and there is always something entering from the right.
  let run = [...photos]
  const target = 2.6 * (viewport / 800)
  const width = (list) => list.reduce((sum, p, i) => {
    const step = rhythm[i % rhythm.length]
    return sum + step.size * (p.ratio ?? 0.75) + gap
  }, 0)
  let guard = 0
  while (width(run) < target && guard++ < 6) run = [...run, ...photos]

  let x = 0
  const frames = run.map((photo, i) => {
    const step = rhythm[i % rhythm.length]
    // A hair of wander so the line is drawn by hand, not by a ruler.
    const size = step.size * (0.94 + rand() * 0.12)
    const w = size * (photo.ratio ?? 0.75)

    const frame = {
      photo,
      x: x + w / 2,
      y: step.y + (rand() - 0.5) * 0.03,
      w,
      h: size,
      // Larger frames are nearer, and near things move a little faster. Kept
      // small: enough to feel, not enough to pull the line apart.
      depth: 0.94 + (size / 0.74) * 0.12,
      // The quiet ones sit back in the dark until you come near them.
      dim: 0.5 + Math.min(size / 0.74, 1) * 0.5,
      phase: rand() * Math.PI * 2,
      key: `${photo.id}-${i}`,
    }
    x += w + gap
    return frame
  })

  return { frames, loop: x }
}
