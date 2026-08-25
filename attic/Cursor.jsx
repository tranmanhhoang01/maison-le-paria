import { useEffect, useRef } from 'react'
import { useExperience } from '../../store/experience.js'
import { damp } from '../../lib/math.js'

const LABEL = { idle: '', view: 'XEM', enter: 'MỞ', back: 'RA' }

/**
 * Trails the pointer rather than tracking it. Hidden entirely on touch, where
 * a cursor is a lie.
 */
export function Cursor() {
  const mode = useExperience((s) => s.cursor)
  const el = useRef(null)
  const pos = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const onMove = (e) => { pos.current.tx = e.clientX; pos.current.ty = e.clientY }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf, last = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const p = pos.current
      p.x = damp(p.x, p.tx, 9, dt)
      p.y = damp(p.y, p.ty, 9, dt)
      if (el.current) el.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove) }
  }, [])

  return (
    <div ref={el} className="cursor" data-mode={mode} aria-hidden="true">
      <span className="cursor__ring" />
      <span className="cursor__label micro">{LABEL[mode]}</span>
    </div>
  )
}
