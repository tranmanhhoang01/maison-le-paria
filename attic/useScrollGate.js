import { useEffect } from 'react'
import { scroll } from '../lib/scrollState.js'

/**
 * Flips a data attribute when scroll passes a threshold. A React state change
 * here would re-render the overlay on every frame near the boundary; an
 * attribute write is free and CSS does the rest.
 */
export function useScrollGate(ref, { at = 0.9, attribute = 'data-past' } = {}) {
  useEffect(() => {
    let raf
    let past = null
    const loop = () => {
      const now = scroll.progress >= at
      if (now !== past && ref.current) {
        past = now
        ref.current.setAttribute(attribute, String(now))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ref, at, attribute])
}
