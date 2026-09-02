import { site } from '../../data/site.js'
import { useExperience } from '../../store/experience.js'
import { Seal } from './Seal.jsx'

/**
 * The screen between two pages — the same one the site opens with, so
 * arriving somewhere always looks like arriving.
 */
export function Curtain() {
  const phase = useExperience((s) => s.curtain)
  return (
    <div className="curtain sheet" data-phase={phase ?? 'gone'} aria-hidden="true">
      <Seal />
      <p className="curtain__name serif">
        <span>MAISON</span>
        <span>LE PARIA</span>
      </p>
      <p className="curtain__tag micro">{site.tagline}</p>
    </div>
  )
}
