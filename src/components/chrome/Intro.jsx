import { useEffect, useState } from 'react'
import { site } from '../../data/site.js'

/**
 * The name of the house, then it gets out of the way. No button to press —
 * asking for a click before showing any photographs was the first thing that
 * made this site feel like work.
 */
export function Intro({ count }) {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 2600)
    const skip = () => setGone(true)
    window.addEventListener('pointerdown', skip, { once: true })
    window.addEventListener('wheel', skip, { once: true, passive: true })
    window.addEventListener('keydown', skip, { once: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('wheel', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  return (
    <div className="intro" data-gone={gone} aria-hidden={gone}>
      <div className="intro__inner">
        <span className="seal intro__seal" aria-hidden="true"><span>M</span></span>
        <h1 className="intro__name serif">
          <span>MAISON</span>
          <span>LE PARIA</span>
        </h1>
        <p className="intro__tag meta">{site.tagline}</p>
        <div className="meander meander--short intro__ornament" aria-hidden="true" />
        <p className="intro__hint micro">{count} ẢNH — CUỘN HOẶC KÉO ĐỂ ĐI · BẤM ĐỂ MỞ</p>
        <p className="intro__sound micro">BẤM ĐỂ VÀO · CÓ ÂM THANH</p>
      </div>
    </div>
  )
}
