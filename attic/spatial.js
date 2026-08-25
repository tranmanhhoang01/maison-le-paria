import { mulberry32 } from './math.js'

/**
 * All scene geometry is computed here, as pure functions of data + tier.
 * Layout is the one thing that must never drift between renders, so every
 * "random" value comes from a seeded generator keyed to the item's index.
 */

export const CORRIDOR = {
  entry: -9,      // where the hero plate hangs
  first: -34,     // first door
  gap: 30,        // distance between doors
  tail: 30,       // space after the last door before the track ends
}

/** The doors of the universe: one plane per project, alternating across the path. */
export function corridorLayout(projects, tier) {
  const wide = tier.name === 'low' || tier.name === 'medium'
  return projects.map((project, i) => {
    const rand = mulberry32(1000 + i * 97)
    const side = i % 2 === 0 ? -1 : 1
    const offset = wide ? 0.55 : 2.45 + rand() * 0.5
    const height = wide ? 6.3 : 5.9 + rand() * 0.7
    const ratio = project.coverImage?.ratio ?? 0.75
    return {
      project,
      position: [side * offset, -0.15 + (rand() - 0.5) * 0.5, CORRIDOR.first - i * CORRIDOR.gap],
      rotation: [0, side * (wide ? 0.04 : 0.17), (rand() - 0.5) * 0.012],
      size: [height * ratio, height],
      side,
    }
  })
}

export function corridorLength(projects) {
  return Math.abs(CORRIDOR.first - (projects.length - 1) * CORRIDOR.gap) + CORRIDOR.tail
}

/**
 * A project space: photographs suspended at different depths along the path,
 * sized by their own aspect ratio so nothing is ever cropped into a square.
 */
export function roomLayout(images, tier) {
  const narrow = tier.name === 'low' || tier.name === 'medium'
  const step = narrow ? 12 : 13.5
  return images.map((image, i) => {
    const rand = mulberry32(4000 + i * 131)
    const side = i % 2 === 0 ? -1 : 1
    const portrait = (image.ratio ?? 0.75) < 1

    // Every third frame steps into the centre of the path and grows —
    // it becomes the "hero" beat of the sequence.
    const focal = i % 3 === 2
    const height = (focal ? 6.4 : portrait ? 5.0 : 4.2) * (narrow ? 0.86 : 1) + rand() * 0.5
    const x = focal ? (rand() - 0.5) * 0.6 : side * (narrow ? 0.9 + rand() * 0.4 : 2.5 + rand() * 1.1)
    const y = (rand() - 0.5) * (narrow ? 0.9 : 1.9)

    return {
      image,
      position: [x, y, -8 - i * step - rand() * 2],
      rotation: [0, focal ? 0 : side * (narrow ? 0.05 : 0.2), (rand() - 0.5) * 0.02],
      size: [height * (image.ratio ?? 0.75), height],
      drift: 0.4 + rand() * 0.8,
      phase: rand() * Math.PI * 2,
    }
  })
}

export function roomLength(images, tier) {
  const layout = roomLayout(images, tier)
  const last = layout[layout.length - 1]
  return Math.abs(last?.position[2] ?? 40) + 20
}
