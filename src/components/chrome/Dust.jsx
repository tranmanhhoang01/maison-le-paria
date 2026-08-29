import { useEffect, useRef } from 'react'
import { mulberry32 } from '../../lib/math.js'

/**
 * The room the photographs hang in. A 2D canvas rather than a WebGL scene:
 * it costs a few hundred bytes, it never competes with the photographs for
 * the GPU, and — unlike a texture — it cannot make anything look soft.
 *
 * On paper these are motes in a shaft of light rather than stars, so they
 * darken the sheet instead of glowing on it.
 */
export function Dust({ compact }) {
  const canvas = useRef(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = el.getContext('2d', { alpha: true })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const count = compact ? 26 : 70
    const rand = mulberry32(11)

    let w = 0
    let h = 0
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      el.width = w * dpr
      el.height = h * dpr
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const motes = Array.from({ length: count }, () => ({
      x: rand(), y: rand(),
      r: 0.4 + rand() * rand() * 1.7,
      a: 0.04 + rand() * 0.1,
      vx: (rand() - 0.5) * 0.012,
      vy: (rand() - 0.5) * 0.008,
    }))

    let raf
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const m of motes) {
        m.x += m.vx / 60
        m.y += m.vy / 60
        if (m.x < -0.02) m.x = 1.02
        if (m.x > 1.02) m.x = -0.02
        if (m.y < -0.02) m.y = 1.02
        if (m.y > 1.02) m.y = -0.02
        ctx.beginPath()
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(94, 72, 48, ${m.a})`
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [compact])

  return <canvas ref={canvas} className="dust" aria-hidden="true" />
}
