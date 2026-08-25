import { useEffect } from 'react'
import Lenis from 'lenis'
import { updateScroll, setTrackLength, resetScroll } from '../lib/scrollState.js'
import { experience } from '../store/experience.js'

/**
 * One Lenis instance for the whole app. It drives a virtual track whose only
 * purpose is to give the camera something to read; the DOM barely moves.
 */
let lenis = null

export function getLenis() { return lenis }

export function useSmoothScroll(enabled) {
  useEffect(() => {
    if (!enabled) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    lenis = new Lenis({
      duration: reduced ? 0.1 : 1.5,
      // A long, flat curve: the space should feel heavy, like pushing a door.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !reduced,
      syncTouch: true,
      syncTouchLerp: 0.09,
      touchInertiaMultiplier: 12,
      wheelMultiplier: 0.9,
    })

    if (import.meta.env.DEV) window.__lenis = lenis

    const onScroll = ({ scroll, velocity }) => updateScroll(scroll, velocity)
    lenis.on('scroll', onScroll)

    let raf = requestAnimationFrame(function loop(time) {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    })

    // Lenis owns the scroll position, which means the browser's own keyboard
    // scrolling stops working. Walking the space with a keyboard has to be
    // possible, so it is re-implemented here — and handed back to the viewer
    // when the viewer is the thing on screen.
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (experience.get().viewer) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

      const page = window.innerHeight * 0.82
      const step = window.innerHeight * 0.22
      const limit = document.body.scrollHeight - window.innerHeight
      const moves = {
        PageDown: page, PageUp: -page, ' ': e.shiftKey ? -page : page,
        ArrowDown: step, ArrowUp: -step,
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        lenis.scrollTo(e.key === 'Home' ? 0 : limit, { duration: 2.6 })
        return
      }
      const delta = moves[e.key]
      if (delta === undefined) return
      e.preventDefault()
      lenis.scrollTo(lenis.targetScroll + delta, { duration: 1.4 })
    }
    window.addEventListener('keydown', onKey)

    const measure = () => setTrackLength(document.body.scrollHeight - window.innerHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      ro.disconnect()
      lenis.destroy()
      lenis = null
    }
  }, [enabled])
}

/** Called on every space change so a new room always starts at its beginning. */
export function rewind() {
  resetScroll()
  lenis?.scrollTo(0, { immediate: true })
  window.scrollTo(0, 0)
}

export function lockScroll(locked) {
  if (!lenis) return
  locked ? lenis.stop() : lenis.start()
}
