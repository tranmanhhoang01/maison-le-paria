/**
 * Triện — the seal.
 *
 * The form is a Nguyễn court seal: a square of cinnabar, a double border with
 * a hair's gap between the two rules, and four blocks set in a grid. The
 * blocks are hồi văn — the meander that runs under every title on this site —
 * turned four ways, drawn in one even stroke the way seal script is cut.
 *
 * They are deliberately not writing. A first pass drew four real characters
 * that spelt nothing; and the inscription on an actual imperial seal is a
 * national artefact, not a photographer's logo.
 */
const KEY = 'M4 28V6h20M24 10v14H10M10 20v-6h8'
const TURNS = [
  'translate(14 14)',
  'translate(86 14) scale(-1 1)',
  'translate(14 86) scale(1 -1)',
  'translate(86 86) scale(-1 -1)',
]

export function Seal({ className = '' }) {
  return (
    <span className={`seal ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 100 100" role="presentation" focusable="false">
        <rect className="seal__field" width="100" height="100" rx="2.5" />
        <g className="seal__cut">
          <rect x="6" y="6" width="88" height="88" rx="1" strokeWidth="1.8" />
          <rect x="10" y="10" width="80" height="80" rx="0.5" strokeWidth="0.9" opacity="0.8" />
          {TURNS.map((t) => <path key={t} d={KEY} transform={t} strokeWidth="2.3" />)}
        </g>
      </svg>
    </span>
  )
}
