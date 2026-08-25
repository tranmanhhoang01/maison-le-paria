import { navigate } from './router.js'
import { setCurtain, experience } from '../store/experience.js'

/**
 * Moving between pages goes behind a curtain rather than cutting straight to
 * the new one.
 *
 * It is not decoration: the library holds forty-seven full-size photographs
 * and the overview a whole plane of them, so a hard cut lands you in a
 * half-painted page. The curtain closes first, the page changes behind it,
 * and it lifts on something that is already there.
 */
const CLOSE = 300      // curtain is opaque before the page changes
const HOLD = 280       // the new page gets a moment to lay itself out
const OPEN = 700       // length of the lift, matching the CSS transition
const FAILSAFE = 3000  // a curtain that will not lift is worse than no curtain

let timers = []
const clear = () => { timers.forEach(clearTimeout); timers = [] }
const later = (fn, ms) => { timers.push(setTimeout(fn, ms)) }

export function travelTo(path) {
  if (path === window.location.pathname) return
  if (experience.get().curtain) return   // already travelling

  clear()
  setCurtain('cover')

  // Whatever happens below, the curtain comes up.
  later(() => { if (experience.get().curtain) setCurtain(null) }, FAILSAFE)

  later(() => {
    navigate(path)
    // Wait for the hold *and* for a real painted frame, so the curtain never
    // lifts onto a page that has not drawn itself yet.
    later(() => {
      requestAnimationFrame(() => {
        setCurtain('reveal')
        later(() => setCurtain(null), OPEN)
      })
    }, HOLD)
  }, CLOSE)
}
