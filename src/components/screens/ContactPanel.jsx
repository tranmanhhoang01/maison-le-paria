import { site } from '../../data/site.js'
import { Seal } from '../chrome/Seal.jsx'
import { Nghe, Clouds, CloudField } from '../chrome/Ornament.jsx'

/** Five lines and a door. No form. */
export function ContactPanel() {
  const { contact } = site
  return (
    <article className="panel" data-in="true">
      <CloudField seed={59} count={4} className="cloud-field--page" />
      <div className="panel__inner">
        <p className="panel__eyebrow micro lift">LIÊN HỆ</p>
        <h1 className="panel__title serif lift">{contact.headline}</h1>
        <Clouds className="clouds--short panel__clouds lift" />
        <p className="panel__lead lift">{contact.note}</p>

        <ul className="channels lift">
          {contact.channels.map((c) => (
            <li key={c.label} className="channel">
              <span className="micro">{c.label}</span>
              {c.href
                ? <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{c.value}</a>
                : <span>{c.value}</span>}
            </li>
          ))}
        </ul>

        <a className="cta meta lift" href={contact.cta.href}>
          {contact.cta.label}<span className="cta__line" />
        </a>

        <div className="crest panel__foot lift">
          <Nghe facing="right" />
          <Seal />
          <Nghe facing="left" />
        </div>
      </div>
    </article>
  )
}
