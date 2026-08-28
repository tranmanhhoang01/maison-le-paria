/**
 * The overview is a wall.
 *
 * Photographs hung in a line, still, evenly spaced, with a text panel opening
 * each series — the way an exhibition is actually laid out. You walk along it.
 * Nothing drifts, nothing overlaps, nothing competes with the work.
 *
 * Two rules carry the whole thing.
 *
 * Every piece is centred on a single horizontal axis at eye level, whatever
 * its size. Galleries have done it that way for a century because it turns a
 * row of different objects into one calm line.
 *
 * And you stand in front of one work at a time. An earlier version fitted
 * five on the screen at once, evenly spaced and evenly sized: the eye had
 * nowhere to rest and every photograph looked like every other. So the works
 * are spaced far enough apart that only one can hold the middle of the room,
 * and the wall settles onto it when you stop walking.
 */

/** Eye level, as a fraction of the viewport height. */
export const EYE = 0.5

/** Heights by orientation, as fractions of the viewport height. */
const HEIGHT = { portrait: 0.74, square: 0.66, landscape: 0.54 }

/**
 * Air between works. Wide on purpose: at this spacing the next photograph is
 * a promise at the edge of vision rather than a rival for attention.
 */
const GAP = 0.5
const SECTION_GAP = 0.9
/** Width of a series' wall text. */
const PANEL = 0.8
/**
 * Empty wall before the first work and after the last. It has to be at least
 * half a screen wide, or the wall cannot travel far enough to bring the first
 * piece into the middle of the room — it would sit pinned to the left edge.
 */
const MARGIN = 1.1

const heightFor = (ratio = 0.75) =>
  ratio < 0.9 ? HEIGHT.portrait : ratio < 1.2 ? HEIGHT.square : HEIGHT.landscape

/**
 * Lays the wall out left to right. Everything is measured in viewport heights,
 * so the hang keeps its proportions on any screen.
 */
export function buildWall(sets, { compact = false } = {}) {
  const scale = compact ? 0.78 : 1
  const gap = GAP * (compact ? 0.8 : 1)
  const items = []
  let x = MARGIN

  sets.forEach((set, s) => {
    if (s > 0) x += SECTION_GAP - gap

    items.push({
      kind: 'panel',
      set,
      x,
      w: PANEL * scale,
      key: `panel-${set.id}`,
    })
    // Measured against the screen, not by eye: with the panel centred, its
    // edge sits PANEL/2 from the middle and the screen edge sits about 0.8
    // away, so anything wider than ~0.4 pushes the first work out of the room
    // entirely. A room always promises the next thing.
    x += PANEL * scale + 0.28

    set.images.forEach((image, i) => {
      const h = heightFor(image.ratio) * scale
      const w = h * (image.ratio ?? 0.75)
      items.push({
        kind: 'photo',
        image,
        set,
        number: i + 1,
        x,
        w,
        h,
        key: image.id,
      })
      x += w + gap
    })
  })

  // Every item is a place to stand: the wall settles onto one of these.
  items.forEach((item, i) => { item.index = i })

  return { items, width: x - gap + MARGIN }
}
