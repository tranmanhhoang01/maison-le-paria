/**
 * The overview is a wall.
 *
 * Photographs hung in a line, still, evenly spaced, with a text panel opening
 * each series — the way an exhibition is actually laid out. You walk along it.
 * Nothing drifts, nothing overlaps, nothing competes with the work.
 *
 * The one rule that makes a hang look professional: every piece is centred on
 * a single horizontal axis at eye level, whatever its size. Galleries have
 * done it that way for a century because it turns a row of different objects
 * into one calm line.
 */

/** Eye level, as a fraction of the viewport height. */
export const EYE = 0.5

/** Heights by orientation, as fractions of the viewport height. */
const HEIGHT = { portrait: 0.62, square: 0.55, landscape: 0.44 }

/** Air between works, and the wider breath between series. */
const GAP = 0.13
const SECTION_GAP = 0.34
/** Width of a series' wall text. */
const PANEL = 0.5
/** Space held clear at each end of the wall. */
const MARGIN = 0.22

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
    x += PANEL * scale + SECTION_GAP * 0.7

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

  return { items, width: x - gap + MARGIN }
}
