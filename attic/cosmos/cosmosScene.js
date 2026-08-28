import { galaxyColours, makeDot, makeGalaxy, makeStars } from './cosmos.js'
import { persp } from './constellation.js'
import { mulberry32 } from './math.js'

/**
 * The night sky the overview lives in.
 *
 * Everything is projected: each star, cloud and galaxy carries a distance,
 * and distance decides how large it draws and how much it slides when you
 * drag. That is the whole of the depth here — no 3D engine, just one divide
 * per object per frame.
 *
 * Not a React component: it owns a canvas and a draw call, and the overview
 * drives it from the same animation frame that moves the photographs. Two
 * loops would drift apart and the parallax would go soft.
 */
export function createCosmos(canvas, sets, { compact = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const colours = galaxyColours(sets)
  const rand = mulberry32(90210)

  const GALAXY_PX = compact ? 380 : 600
  const NEBULA_PX = compact ? 460 : 700

  const dot = makeDot(24, 'rgba(255,255,255,1)')
  const warmDot = makeDot(24, 'rgba(255,206,158,1)')
  const coolDot = makeDot(24, 'rgba(170,200,255,1)')
  const galaxySprites = colours.map((c, i) => makeGalaxy(GALAXY_PX, c, 4200 + i * 77))

  /**
   * Clouds, drawn straight onto the sky each frame rather than stamped from a
   * sprite. A sprite is a square, and however carefully its edges are faded a
   * square eventually shows itself — which is the one thing that gives away a
   * painted nebula. A gradient has no corners to give away.
   */
  const nebulae = colours.flatMap((c, i) => Array.from({ length: 5 }, (_, k) => ({
    hue: (c.hue + (k - 2) * 26 + 360) % 360,
    x: (rand() - 0.5) * 13,
    y: (rand() - 0.5) * 9,
    z: 2.2 + rand() * 6,
    radius: 1.9 + rand() * 2.4,
    drift: 0.3 + rand() * 0.6,
    alpha: 0.05 + rand() * 0.07,
    phase: rand() * Math.PI * 2,
  })))

  const stars = makeStars(compact ? 620 : 1600, 31337)
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

  /** Deep space, painted once per resize — a gradient, never a flat black. */
  let ground = null
  let groundKey = ''
  function paintGround() {
    const key = `${w}x${h}`
    if (key === groundKey && ground) return ground
    groundKey = key
    ground = document.createElement('canvas')
    ground.width = w
    ground.height = h
    const g = ground.getContext('2d')

    g.fillStyle = '#070818'
    g.fillRect(0, 0, w, h)

    // Two broad washes of colour so the "black" of space is never actually
    // black — it is the darkest part of something coloured.
    const a = g.createRadialGradient(w * 0.22, h * 0.28, 0, w * 0.22, h * 0.28, Math.max(w, h) * 0.85)
    a.addColorStop(0, 'rgba(46, 38, 120, 0.55)')
    a.addColorStop(0.55, 'rgba(22, 20, 62, 0.30)')
    a.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = a
    g.fillRect(0, 0, w, h)

    const b = g.createRadialGradient(w * 0.82, h * 0.78, 0, w * 0.82, h * 0.78, Math.max(w, h) * 0.8)
    b.addColorStop(0, 'rgba(96, 30, 96, 0.42)')
    b.addColorStop(0.5, 'rgba(30, 16, 54, 0.24)')
    b.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = b
    g.fillRect(0, 0, w, h)

    return ground
  }

  /**
   * @param view  { x, y, z } pan in pixels and zoom, shared with the photos
   * @param unit  world unit → pixels at zoom 1
   * @param time  seconds
   * @param focus index of the galaxy under the pointer, or -1
   * @param open  0 → 1 per galaxy
   * @returns screen positions of every galaxy, for hit-testing
   */
  function draw(view, unit, time, focus, open = []) {
    const cx = w / 2
    const cy = h / 2

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(paintGround(), 0, 0)
    ctx.globalCompositeOperation = 'lighter'

    const project = (x, y, z) => {
      const p = persp(z)
      return {
        x: cx + (x * unit * view.z + view.x) * p,
        y: cy + (y * unit * view.z + view.y) * p,
        p,
      }
    }

    // Clouds, furthest away and barely stirring.
    ctx.globalAlpha = 1
    for (const n of nebulae) {
      const q = project(n.x, n.y, n.z)
      const r = n.radius * unit * view.z * q.p
      const x = q.x + Math.sin(time * 0.02 * n.drift + n.phase) * 26
      const y = q.y + Math.cos(time * 0.017 * n.drift + n.phase) * 18
      if (x + r < 0 || x - r > w || y + r < 0 || y - r > h) continue

      const breathe = 0.86 + 0.14 * Math.sin(time * 0.06 + n.phase)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * breathe)
      g.addColorStop(0, `hsla(${n.hue}, 88%, 62%, ${n.alpha})`)
      g.addColorStop(0.45, `hsla(${n.hue}, 82%, 52%, ${n.alpha * 0.5})`)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r * breathe, 0, Math.PI * 2)
      ctx.fill()
    }

    // Stars. Each has its own distance, so dragging slides the near ones past
    // the far ones — which is the whole reason the sky reads as deep.
    const span = Math.max(w, h) * 1.5
    for (const s of stars) {
      const p = persp(s.z)
      const px = ((s.x * span + view.x * p * 0.8) % span + span * 1.5) % span - span * 0.25
      const py = ((s.y * span + view.y * p * 0.8) % span + span * 1.5) % span - span * 0.25
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue
      const twinkle = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase)
      const size = s.size * p * (1 + view.z * 0.15)
      ctx.globalAlpha = s.base * twinkle * (0.35 + p * 0.8)
      const sprite = s.warm ? warmDot : s.cool ? coolDot : dot
      ctx.drawImage(sprite, px - size, py - size, size * 2, size * 2)
    }

    // Galaxies, each leaning at its own angle.
    const placed = []
    for (let i = 0; i < sets.length; i++) {
      const g = sets[i].place
      const q = project(g.x, g.y, g.z)
      const size = g.radius * 2 * unit * view.z * q.p
      placed.push({ x: q.x, y: q.y, radius: size / 2, p: q.p })
      if (q.x + size < 0 || q.x - size > w || q.y + size < 0 || q.y - size > h) continue

      const lit = open[i] ?? (focus === i ? 1 : 0)
      const elsewhere = Math.max(0, ...open.filter((_, j) => j !== i))
      const breathe = 1 + Math.sin(time * 0.22 + i) * 0.012
      const s = size * breathe * (1 + lit * 0.05)

      ctx.save()
      ctx.translate(q.x, q.y)
      ctx.rotate(g.roll)                 // which way the disc is turned
      ctx.scale(1, Math.cos(g.tilt))     // how far it is tipped away from us
      ctx.rotate(time * g.spin)          // and its own slow rotation
      ctx.globalAlpha = (0.7 + lit * 0.3) * (1 - elsewhere * 0.62)
      ctx.drawImage(galaxySprites[i], -s / 2, -s / 2, s, s)
      ctx.restore()
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return placed
  }

  return { draw, resize, colours }
}
