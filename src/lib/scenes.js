import { site } from '../data/site.js'

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

function pickPlates(images, cover = 0) {
  if (images.length <= PLATES) return images
  // The cover, then two spread across the rest — a set should introduce
  // itself with its best frame and two that show its range.
  const rest = images.filter((_, i) => i !== cover)
  const step = Math.floor(rest.length / (PLATES - 1))
  return [images[cover], rest[step], rest[Math.min(step * 2, rest.length - 1)]]
}

export function buildScenes(sets) {
  const scenes = [
    {
      kind: 'opening',
      key: 'opening',
      title: site.name,
      tagline: site.tagline,
      line: site.about.statement,
      // One photograph stands behind the name, held right back.
      backdrop: sets[0]?.images?.[0] ?? null,
    },
  ]

  sets.forEach((set) => {
    scenes.push({
      kind: 'series',
      key: set.id,
      set,
      plates: pickPlates(set.images, Math.min(2, set.images.length - 1)),
    })
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
