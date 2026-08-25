import { useRef } from 'react'
import { site } from '../../data/site.js'
import { useExperience } from '../../store/experience.js'
import { useScrollFade } from '../../hooks/useScrollFade.js'
import { useScrollGate } from '../../hooks/useScrollGate.js'
import { navigate } from '../../lib/router.js'
import { getLenis } from '../../hooks/useSmoothScroll.js'
import { ScrollMeter } from '../chrome/ScrollMeter.jsx'

/**
 * Everything the universe says. Two blocks only: the name of the house at the
 * entrance, and the name of whichever door you are currently level with.
 */
export function UniverseOverlay({ projects, onEnter }) {
  const hero = useRef(null)
  const outro = useRef(null)
  const focus = useExperience((s) => s.focus)
  const entered = useExperience((s) => s.entered)
  useScrollFade(hero, { start: 0.005, end: 0.075, lift: 60 })
  useScrollGate(outro, { at: 0.955 })

  const project = focus >= 0 ? projects[focus] : null

  return (
    <div className="overlay">
      <section ref={hero} className="hero" data-in={entered}>
        <p className="hero__eyebrow meta lift">{site.tagline}</p>
        <h1 className="hero__name serif lift">
          <span>MAISON</span>
          <span>LE PARIA</span>
        </h1>
        <p className="hero__line lift">{site.hero.line}</p>
        <p className="hero__hint micro lift">
          {site.hero.hint}
          <span className="hero__hint-line" />
        </p>
      </section>

      <div className="doors" data-visible={!!project}>
        {project && (
          <button className="door" key={project.id} onClick={() => onEnter(project)}>
            <span className="door__num micro">{project.number}</span>
            <span className="door__title serif">{project.title}</span>
            <span className="door__meta meta">{project.category} — {project.year}</span>
            <span className="door__sub micro">{project.subtitle}</span>
            <span className="door__cta micro">MỞ KHÔNG GIAN →</span>
          </button>
        )}
      </div>

      {/* The far end of the corridor. Without this the universe simply runs
          out of photographs and leaves the visitor in the dark. */}
      <section ref={outro} className="outro" data-past="false">
        <p className="outro__mark serif">MAISON LE PARIA</p>
        <p className="outro__line micro">BỐN KHÔNG GIAN — {new Date().getFullYear()}</p>
        <div className="outro__links">
          <button className="meta" onClick={() => getLenis()?.scrollTo(0, { duration: 2.4 })}>VỀ ĐẦU</button>
          <button className="meta" onClick={() => navigate('/muc-luc')}>MỤC LỤC</button>
          <button className="meta" onClick={() => navigate('/lien-he')}>LIÊN HỆ</button>
        </div>
      </section>

      <ScrollMeter label="VŨ TRỤ" />
    </div>
  )
}
