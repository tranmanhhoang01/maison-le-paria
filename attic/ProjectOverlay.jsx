import { useRef } from 'react'
import { useScrollFade } from '../../hooks/useScrollFade.js'
import { ScrollMeter } from '../chrome/ScrollMeter.jsx'

/**
 * A project's story sits at its entrance and then gets out of the way —
 * once you are inside, the photographs are the only thing on screen.
 */
export function ProjectOverlay({ project, next, onBack, onNext }) {
  const head = useRef(null)
  useScrollFade(head, { start: 0.01, end: 0.14, lift: 70 })

  return (
    <div className="overlay">
      <button className="back meta" onClick={onBack}>
        <span className="back__arrow">←</span> VŨ TRỤ
      </button>

      <section ref={head} className="story" data-in="true">
        <p className="story__num micro lift">{project.number} — {project.category}</p>
        <h1 className="story__title serif lift">{project.title}</h1>
        <div className="rule lift" />
        <p className="story__sub meta lift">{project.subtitle}</p>
        <p className="story__desc lift">{project.description}</p>
        <dl className="story__meta lift">
          <div><dt className="micro">ĐỊA ĐIỂM</dt><dd>{project.location}</dd></div>
          <div><dt className="micro">NĂM</dt><dd>{project.year}</dd></div>
          <div><dt className="micro">SỐ ẢNH</dt><dd>{String(project.images.length).padStart(2, '0')}</dd></div>
        </dl>
        <p className="story__hint micro lift">CUỘN ĐỂ ĐI SÂU VÀO<span className="hero__hint-line" /></p>
      </section>

      {next && (
        <button className="next meta" onClick={() => onNext(next)}>
          TIẾP THEO — {next.title}
        </button>
      )}

      <ScrollMeter label={project.title} />
    </div>
  )
}
