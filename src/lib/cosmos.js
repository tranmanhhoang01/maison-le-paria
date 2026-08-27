import { mulberry32 } from './math.js'

/**
 * The machinery behind the overview's night sky. Everything here is drawn
 * from numbers — there is no space photograph anywhere in this project, and
 * nothing to download. Stars, nebulae and galaxies are all painted once into
 * offscreen canvases at startup, then stamped onto the screen each frame,
 * which is what lets a few thousand glowing points move at 60fps.
 */

/* ── Colour ──────────────────────────────────────────────────────────── */

export function rgbToHsl([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0))
    : max === G ? (B - R) / d + 2
    : (R - G) / d + 4
  return [h * 60, s, l]
}

/**
 * Photographs give us a hue worth keeping and a saturation that is no use to
 * a nebula. So: keep the hue, insist on the glow — and if two sets landed on
 * nearly the same hue, push them apart so their galaxies never read as one.
 */
export function galaxyColours(sets) {
  const hues = sets.map((set) => rgbToHsl(set.rgb ?? [150, 150, 200])[0])

  // Built with a plain loop, not map: each hue has to see the ones already
  // decided, and an array cannot read itself while it is being created.
  const spread = []
  for (const h of hues) {
    let hue = h
    for (let attempt = 0; attempt < 6; attempt++) {
      const tooClose = spread.some((other) => {
        const gap = Math.abs(((hue - other + 540) % 360) - 180)
        return gap > 320 || gap < 40
      })
      if (!tooClose) break
      hue = (hue + 62) % 360
    }
    spread.push(hue)
  }

  return spread.map((hue) => ({
    hue,
    core: `hsl(${hue}, 92%, 88%)`,
    arm: `hsl(${hue}, 88%, 66%)`,
    rim: `hsl(${(hue + 42) % 360}, 90%, 58%)`,
    glow: `hsla(${hue}, 92%, 62%, 0.42)`,
  }))
}

/* ── Sprites ─────────────────────────────────────────────────────────── */

/** A soft round dot. Everything luminous in this sky is one of these. */
export function makeDot(size, colour) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, colour)
  g.addColorStop(0.4, colour.replace(/[\d.]+\)$/, '0.35)'))
  g.addColorStop(1, colour.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

/**
 * One galaxy, painted once.
 *
 * Two logarithmic arms of scattered points, brightest at the core and cooling
 * outward, with a dust lane of darker specks so the arms have some grain
 * rather than reading as a clean mathematical curve.
 */
export function makeGalaxy(size, colour, seed) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const rand = mulberry32(seed)
  const mid = size / 2
  const max = size * 0.46

  ctx.globalCompositeOperation = 'lighter'

  // Core: a bright bulge that falls away fast.
  const core = ctx.createRadialGradient(mid, mid, 0, mid, mid, max * 0.42)
  core.addColorStop(0, colour.core)
  core.addColorStop(0.22, colour.arm)
  core.addColorStop(1, 'transparent')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(mid, mid, max * 0.42, 0, Math.PI * 2)
  ctx.fill()

  // Arms.
  const ARMS = 2
  const STARS = 2600
  for (let i = 0; i < STARS; i++) {
    const t = i / STARS
    const arm = i % ARMS
    // Logarithmic spiral, loosened as it goes out.
    const angle = t * Math.PI * 3.4 + (arm * Math.PI * 2) / ARMS
    const radius = Math.pow(t, 0.62) * max
    const scatter = (0.06 + t * 0.30) * max
    const x = mid + Math.cos(angle) * radius + (rand() - 0.5) * scatter
    const y = mid + Math.sin(angle) * radius * 0.94 + (rand() - 0.5) * scatter

    const near = 1 - t
    const r = 0.5 + rand() * (0.8 + near * 1.9)
    ctx.globalAlpha = 0.10 + near * 0.55 * rand()
    ctx.fillStyle = rand() < 0.22 ? colour.rim : (near > 0.55 ? colour.core : colour.arm)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Outer haze, so the galaxy has an edge that dissolves instead of stopping.
  ctx.globalAlpha = 1
  const haze = ctx.createRadialGradient(mid, mid, max * 0.3, mid, mid, max)
  haze.addColorStop(0, colour.glow)
  haze.addColorStop(1, 'transparent')
  ctx.fillStyle = haze
  ctx.beginPath()
  ctx.arc(mid, mid, max, 0, Math.PI * 2)
  ctx.fill()

  return c
}

/** Stars scattered through real depth, so the field has somewhere to go. */
export function makeStars(count, seed) {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => {
    const far = rand()
    return {
      x: rand() * 2 - 1,
      y: rand() * 2 - 1,
      z: far * far * 22,                 // most of them a long way off
      size: 1.0 + rand() * rand() * 4.5,
      base: 0.3 + rand() * 0.65,
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.4,
      warm: rand() < 0.16,
      cool: rand() < 0.22,
    }
  })
}
