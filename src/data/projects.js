import manifest from './generated/images.json'
import catalogue from '../../content/sets.json'
import homeConfig from '../../content/home.json'
import { mediaUrl } from '../lib/media.js'

/**
 * The archive, assembled from three files that nothing else has to know about:
 *
 *   generated/images.json — what photographs exist (written by the pipeline)
 *   content/sets.json     — what they are called (written by the studio app)
 *   content/home.json     — which frame stands behind the opening
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

/**
 * Bề rộng thật của một bản dựng.
 *
 * Đường ống thu ảnh theo `fit: inside`, nghĩa là **cạnh dài** bằng 1000/1600/2400
 * — một ảnh dọc 2:3 có bản "tile" rộng 667px, không phải 1000px. Ghi sai con số
 * này trong srcSet là bảo trình duyệt rằng tệp lớn gấp rưỡi thực tế, và nó sẽ
 * yên tâm chọn một tệp quá nhỏ rồi phóng to lên — đúng cái làm ảnh vỡ nhoè.
 */
const widthAt = (ratio, longest) => Math.round(ratio >= 1 ? longest : longest * ratio)

const rank = (id) => {
  const at = catalogue.order?.indexOf(id) ?? -1
  return at === -1 ? Number.MAX_SAFE_INTEGER : at
}

export const sets = manifest.sets
  .slice()
  .sort((a, b) => rank(a.id) - rank(b.id))
  .map((set, s) => {
    const meta = catalogue.sets?.[set.id] ?? fallback(set.folder)
    const images = set.images.map((image, i) => ({
      ...image,
      tile: mediaUrl(image.tile),
      wide: mediaUrl(image.wide),
      full: mediaUrl(image.full),
      number: String(i + 1).padStart(2, '0'),
      setId: set.id,
      setTitle: meta.title,
      setSubtitle: meta.subtitle,
      srcSet: [
        `${mediaUrl(image.tile)} ${widthAt(image.ratio, 1000)}w`,
        `${mediaUrl(image.wide)} ${widthAt(image.ratio, 1600)}w`,
        `${mediaUrl(image.full)} ${widthAt(image.ratio, 2400)}w`,
      ].join(', '),
    }))

    return {
      ...meta,
      id: set.id,
      number: String(s + 1).padStart(2, '0'),
      images,
      /**
       * The frames that introduce the set on the overview, chosen in the
       * studio. An id that no longer exists — a photograph thrown out after
       * it was picked — simply falls away, and the overview goes back to
       * choosing for itself.
       */
      covers: (catalogue.sets?.[set.id]?.covers ?? [])
        .map((id) => images.find((im) => im.id === id))
        .filter(Boolean)
        .slice(0, 3),
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

/**
 * The opening screen. The frame behind the name is a choice, not the first
 * file in the first folder — it is the one photograph every visitor sees, so
 * the studio owns it. If the chosen frame is gone, the first one stands in.
 */
export const home = {
  backdrop: photos.find((p) => p.id === homeConfig.backdrop) ?? sets[0]?.images?.[0] ?? null,
  veil: typeof homeConfig.veil === 'number' ? homeConfig.veil : 0.3,
}
