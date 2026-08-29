import { site } from '../../data/site.js'
import { useExperience } from '../../store/experience.js'

/**
 * The screen between two pages — the same one the site opens with, so
 * arriving somewhere always looks like arriving.
 */
export function Curtain() {
  const phase = useExperience((s) => s.curtain)
  return (
    <div className="curtain" data-phase={phase ?? 'gone'} aria-hidden="true">
      <span className="seal" aria-hidden="true"><span>M</span></span>
      <p className="curtain__name serif">
        <span>MAISON</span>
        <span>LE PARIA</span>
      </p>
      <p className="curtain__tag micro">{site.tagline}</p>
    </div>
  )
}
