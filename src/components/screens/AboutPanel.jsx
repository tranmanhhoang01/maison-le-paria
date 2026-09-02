import { site } from '../../data/site.js'
import { Seal } from '../chrome/Seal.jsx'
import { Nghe, Clouds, CloudField } from '../chrome/Ornament.jsx'

/** A gallery statement, not a CV. */
export function AboutPanel() {
  return (
    <article className="panel" data-in="true">
      <CloudField seed={23} count={4} className="cloud-field--page" />
      <div className="panel__inner">
        <p className="panel__eyebrow micro lift">GIỚI THIỆU</p>
        <h1 className="panel__title serif lift">{site.name}</h1>
        <Clouds className="clouds--short panel__clouds lift" />
        <p className="panel__lead lift">{site.about.statement}</p>
        {site.about.body.map((line, i) => (
          <p key={i} className="panel__body lift">{line}</p>
        ))}
        <dl className="panel__roles lift">
          {site.about.roles.map(([label, value]) => (
            <div key={label}>
              <dt className="micro">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="crest panel__foot lift">
          <Nghe facing="right" />
          <Seal />
          <Nghe facing="left" />
        </div>
      </div>
    </article>
  )
}
