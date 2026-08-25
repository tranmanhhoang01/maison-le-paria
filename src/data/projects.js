import manifest from './generated/images.json'
import catalogue from '../../content/sets.json'
import { mediaUrl } from '../lib/media.js'

/**
 * The archive, assembled from two files that nothing else has to know about:
 *
 *   generated/images.json — what photographs exist (written by the pipeline)
 *   content/sets.json     — what they are called (written by the studio app)
 *
 * A set with no entry in the catalogue still appears; it simply carries its
 * folder name until someone gives it a better one.
 */
const fallback = (folder) => ({
  title: folder.toUpperCase(),
  subtitle: '',
  description: '',
  year: '',
  location: '',
})

const rank = (id) => {
  const at = catalogue.order?.indexOf(id) ?? -1
  return at === -1 ? Number.MAX_SAFE_INTEGER : at
}

export const sets = manifest.sets
  .slice()
  .sort((a, b) => rank(a.id) - rank(b.id))
  .map((set, s) => {
    const meta = catalogue.sets?.[set.id] ?? fallback(set.folder)
    return {
      ...meta,
      id: set.id,
      number: String(s + 1).padStart(2, '0'),
      images: set.images.map((image, i) => ({
        ...image,
        tile: mediaUrl(image.tile),
        wide: mediaUrl(image.wide),
        full: mediaUrl(image.full),
        number: String(i + 1).padStart(2, '0'),
        setId: set.id,
        setTitle: meta.title,
        setSubtitle: meta.subtitle,
      })),
    }
  })

/**
 * Every photograph, in one list — this is what the overview is built from.
 * Sets are interleaved rather than laid end to end, so the field reads as one
 * body of work instead of three folders parked next to each other.
 */
export const photos = (() => {
  const queues = sets.map((set) => [...set.images])
  const out = []
  let i = 0
  while (queues.some((q) => q.length)) {
    const q = queues[i % queues.length]
    if (q.length) out.push(q.shift())
    i++
  }
  return out
})()

export const photoIndex = (photo) => photos.findIndex((p) => p.id === photo?.id)
