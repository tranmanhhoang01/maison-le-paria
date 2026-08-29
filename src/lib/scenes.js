import { site } from '../data/site.js'
import { home } from '../data/projects.js'

/**
 * The overview is a sequence of chapters, not a gallery.
 *
 * It kept turning into one: a row of photographs you step through — which is
 * exactly what the library already is, and having two pages do the same job
 * is why the overview never had anything to say.
 *
 * So this page answers the questions a first visit actually asks. Who is this?
 * What do they make? Why does it look like that? How do I reach them? Each
 * chapter fills one screen, and each shows only enough of a series to make
 * someone want the whole of it.
 */

/** Three frames per series: one to hold the eye, two to give it context. */
const PLATES = 3

function autoPlates(images, cover = 0) {
  if (images.length <= PLATES) return images
  // The cover, then two spread across the rest — a set should introduce
  // itself with its best frame and two that show its range.
  const rest = images.filter((_, i) => i !== cover)
  const step = Math.floor(rest.length / (PLATES - 1))
  return [images[cover], rest[step], rest[Math.min(step * 2, rest.length - 1)]]
}

/**
 * Which of the two hangs a chapter uses.
 *
 * The three frames are sized in percentages of the chapter's height and take
 * their width from their own aspect ratio, so nothing is cropped while it
 * fits. That only works if the arrangement suits the lead frame: a standing
 * portrait wants its two companions stacked beside it, a lying landscape
 * wants them side by side underneath. Chosen from the ratio alone — no
 * measuring, and therefore nothing to fall out of sync.
 */
const hangFor = (plates) => (plates[0]?.ratio >= 1.05 ? 'landscape' : 'portrait')

export function buildScenes(sets) {
  const scenes = [
    {
      kind: 'opening',
      key: 'opening',
      title: site.name,
      tagline: site.tagline,
      line: site.about.statement,
      // One photograph stands behind the name, chosen in the studio.
      backdrop: home.backdrop,
      veil: home.veil,
    },
  ]

  sets.forEach((set) => {
    const plates = set.covers?.length
      ? set.covers
      : autoPlates(set.images, Math.min(2, set.images.length - 1))
    scenes.push({ kind: 'series', key: set.id, set, plates, hang: hangFor(plates) })
  })

  scenes.push({
    kind: 'closing',
    key: 'closing',
    headline: site.contact.headline,
    note: site.contact.note,
    channels: site.contact.channels.slice(0, 3),
    roles: site.about.roles,
  })

  return scenes
}
