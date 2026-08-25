import { useEffect } from 'react'
import { scroll } from '../lib/scrollState.js'
import { clamp } from '../lib/math.js'

/**
 * Fades and lifts a DOM node against scroll progress without re-rendering it.
 * Used for the captions that have to feel welded to the camera.
 */
export function useScrollFade(ref, { start = 0, end = 0.08, lift = 40 } = {}) {
  useEffect(() => {
    let raf
    let last = -1
    const loop = () => {
      const t = clamp((scroll.progress - start) / (end - start))
      if (Math.abs(t - last) > 0.001 && ref.current) {
        last = t
        ref.current.style.opacity = String(1 - t)
        ref.current.style.transform = `translate3d(0, ${-t * lift}px, 0)`
        ref.current.style.pointerEvents = t > 0.85 ? 'none' : ''
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ref, start, end, lift])
}
