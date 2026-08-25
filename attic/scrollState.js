/**
 * Scroll lives outside React on purpose. It changes 60–120 times a second;
 * routing it through state would re-render the tree for every pixel.
 * The GL layer reads this object inside useFrame, the DOM reads it through
 * a CSS custom property written once per frame.
 */
export const scroll = {
  progress: 0,   // 0 → 1 across the current scene's track
  velocity: 0,
  raw: 0,
}

let track = 1

export function setTrackLength(px) { track = Math.max(1, px) }

export function updateScroll(raw, velocity = 0) {
  scroll.raw = raw
  scroll.progress = Math.min(1, Math.max(0, raw / track))
  scroll.velocity = velocity
}

export function resetScroll() {
  scroll.progress = 0
  scroll.velocity = 0
  scroll.raw = 0
}
