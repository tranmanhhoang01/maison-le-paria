import { galaxyColours, makeDot, makeGalaxy, makeNebula, makeStars } from './cosmos.js'
import { mulberry32 } from './math.js'

/**
 * The night sky the overview lives in.
 *
 * Not a React component: it owns a canvas and a draw call, and the overview
 * drives it from the same animation frame that moves the photographs. Two
 * loops would drift apart from each other and the parallax would go soft.
 */
export function createCosmos(canvas, sets, { compact = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const colours = galaxyColours(sets)
  const rand = mulberry32(90210)

  const GALAXY_PX = compact ? 360 : 560
  const NEBULA_PX = compact ? 420 : 640

  const dot = makeDot(24, 'rgba(255,255,255,1)')
  const warmDot = makeDot(24, 'rgba(255,214,170,1)')
  const galaxySprites = colours.map((c, i) => makeGalaxy(GALAXY_PX, c, 4200 + i * 77))
  const nebulae = colours.map((c, i) => ({
    sprite: makeNebula(NEBULA_PX, c.hue, 8800 + i * 31),
    x: (rand() - 0.5) * 9,
    y: (rand() - 0.5) * 6,
    scale: 4.2 + rand() * 3.4,
    drift: 0.3 + rand() * 0.5,
  }))

  const stars = makeStars(compact ? 520 : 1400, 31337)
  let w = 0, h = 0, dpr = 1

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  /**
   * @param view  { x, y, z } pan in pixels and zoom, shared with the photos
   * @param unit  world unit → pixels at zoom 1
   * @param time  seconds
   * @param focus index of the galaxy under the pointer, or -1
   * @returns screen positions of every galaxy, for hit-testing
   */
  function draw(view, unit, time, focus, open = []) {
    const cx = w / 2
    const cy = h / 2

    // Ground. Not black: a very dark blue reads as depth where black reads as
    // a switched-off screen.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#05060b'
    ctx.fillRect(0, 0, w, h)

    ctx.globalCompositeOperation = 'lighter'

    // Nebulae, furthest away and barely moving.
    for (const n of nebulae) {
      const size = n.scale * unit * view.z
      const x = cx + n.x * unit * view.z + view.x * 0.35 + Math.sin(time * 0.02 * n.drift) * 30
      const y = cy + n.y * unit * view.z + view.y * 0.35 + Math.cos(time * 0.017 * n.drift) * 22
      if (x + size < 0 || x - size > w || y + size < 0 || y - size > h) continue
      ctx.globalAlpha = 0.62
      ctx.drawImage(n.sprite, x - size / 2, y - size / 2, size, size)
    }

    // Stars. Wrapped across the screen so the field never runs out.
    const span = Math.max(w, h) * 1.4
    for (const s of stars) {
      const px = ((s.x * span + view.x * s.depth * 0.5) % span + span * 1.5) % span - span * 0.25
      const py = ((s.y * span + view.y * s.depth * 0.5) % span + span * 1.5) % span - span * 0.25
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue
      const twinkle = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase)
      const size = s.size * (0.8 + s.depth * 0.6) * (1 + view.z * 0.12)
      ctx.globalAlpha = s.base * twinkle
      ctx.drawImage(s.warm ? warmDot : dot, px - size, py - size, size * 2, size * 2)
    }

    // Galaxies.
    const placed = []
    for (let i = 0; i < sets.length; i++) {
      const g = sets[i].place
      const size = g.radius * 2 * unit * view.z
      const x = cx + g.x * unit * view.z + view.x
      const y = cy + g.y * unit * view.z + view.y
      placed.push({ x, y, radius: size / 2 })
      if (x + size < 0 || x - size > w || y + size < 0 || y - size > h) continue

      // Under the pointer a galaxy brightens and leans toward you — and the
      // others step back, so the photographs streaming out of this one are
      // never competing with a rival light across the screen.
      const lit = open[i] ?? (focus === i ? 1 : 0)
      const elsewhere = Math.max(0, ...open.filter((_, j) => j !== i))
      const breathe = 1 + Math.sin(time * 0.22 + i) * 0.012

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(time * g.spin)
      ctx.globalAlpha = (0.72 + lit * 0.28) * (1 - elsewhere * 0.62)
      const s = size * breathe * (1 + lit * 0.06)
      ctx.drawImage(galaxySprites[i], -s / 2, -s / 2, s, s)
      ctx.restore()
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return placed
  }

  return { draw, resize, colours }
}
