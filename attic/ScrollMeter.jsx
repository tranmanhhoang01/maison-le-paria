import { useEffect, useRef } from 'react'
import { scroll } from '../../lib/scrollState.js'

/**
 * Depth gauge. Written straight to the DOM once per frame — routing a value
 * that changes 120 times a second through state would re-render the tree.
 */
export function ScrollMeter({ label }) {
  const fill = useRef(null)

  useEffect(() => {
    let raf
    const loop = () => {
      if (fill.current) fill.current.style.transform = `scaleY(${scroll.progress})`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="meter" aria-hidden="true">
      <span className="meter__label micro">{label}</span>
      <span className="meter__track"><span ref={fill} className="meter__fill" /></span>
    </div>
  )
}
