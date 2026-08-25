import { site } from '../../data/site.js'

/** A gallery statement, not a CV. */
export function AboutPanel() {
  return (
    <article className="panel" data-in="true">
      <div className="panel__inner">
        <p className="panel__eyebrow micro lift">GIỚI THIỆU</p>
        <h1 className="panel__title serif lift">{site.name}</h1>
        <div className="rule lift" />
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
      </div>
    </article>
  )
}
