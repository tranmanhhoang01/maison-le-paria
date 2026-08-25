/**
 * A single static noise tile, moved in whole-pixel steps. Cheaper than a
 * per-frame canvas by orders of magnitude and indistinguishable at this
 * opacity — the point is only that the black is never flat.
 */
export function Grain() {
  return <div className="grain" aria-hidden="true" />
}
