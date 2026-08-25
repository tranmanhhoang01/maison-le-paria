import { useCallback, useState } from 'react'

/**
 * Two things `<img onLoad>` alone gets wrong.
 *
 * It never fires for an image the browser already has — and on a site people
 * revisit, that is most of them. Every photograph here is held at opacity 0
 * until it has arrived, so a cached image would sit invisible behind its own
 * blurred placeholder for ever. The ref catches that the moment the element
 * exists.
 *
 * And an image that was already in cache should not fade in at all: there is
 * nothing to wait for, and a fade over a blur just looks like a smear. Only a
 * photograph that genuinely travelled gets the fade.
 *
 *   const { ready, instant, markReady, catchCached } = useImageReady()
 *   <img ref={catchCached} onLoad={markReady} onError={markReady} />
 */
export function useImageReady() {
  const [state, setState] = useState({ ready: false, instant: false })

  const markReady = useCallback(() => {
    setState((s) => (s.ready ? s : { ready: true, instant: false }))
  }, [])

  const catchCached = useCallback((el) => {
    if (el?.complete && el.naturalWidth > 0) {
      setState((s) => (s.ready ? s : { ready: true, instant: true }))
    }
  }, [])

  return { ready: state.ready, instant: state.instant, markReady, catchCached }
}
