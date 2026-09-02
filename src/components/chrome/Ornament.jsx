import { useId, useMemo } from 'react'
import { mulberry32 } from '../../lib/math.js'

/**
 * Hoa văn — the ornament this house is decorated with.
 *
 * Two motifs, both taken from wood, stone and lacquer rather than from the
 * web: vân mây, the lobed cloud with a trailing tail that runs along a beam,
 * and con nghê, the guardian that sits at a gate or on a roof ridge.
 *
 * Both are drawn as a silhouette with their details cut *out* by a mask, not
 * as pale strokes laid on top. There is often a photograph behind them, and a
 * stroke the colour of paper would show up as a scratch across it.
 */

/* ── Vân mây ─────────────────────────────────────────────────────────── */
/**
 * Mây vẽ bằng **ảnh nền** (`--cloud-mark`), không phải SVG có mask.
 *
 * Hình thì y hệt, nhưng một cái mask SVG là một lượt tô riêng cho trình duyệt,
 * và trên trang có tới mươi đám mây nằm ở lớp `fixed` — mỗi lần cuộn hay trượt
 * là mươi lượt tô. Ảnh nền chỉ tô một lần rồi nằm im trong bộ nhớ.
 */
export function Cloud({ facing = 'right', className = '' }) {
  return <span className={`cloud ${className}`.trim()} data-facing={facing} aria-hidden="true" />
}

/** Two clouds meeting — what stands in for a rule between two things. */
export function Clouds({ className = '' }) {
  return (
    <div className={`clouds ${className}`.trim()} aria-hidden="true">
      <Cloud facing="right" />
      <Cloud facing="left" />
    </div>
  )
}

/**
 * Vân chìm — a drift of clouds sunk into the paper behind a page.
 *
 * Scattered rather than placed: three or four of them, at sizes and angles
 * drawn from a seeded generator, so no two chapters carry the same sky and
 * none of it looks like a repeated tile. Seeded, not random, so the drift is
 * the same on every visit and on every render.
 */
export function CloudField({ seed = 1, count = 4, className = '' }) {
  const drift = useMemo(() => {
    const rand = mulberry32(seed * 9973 + 17)
    return Array.from({ length: count }, () => ({
      left: -6 + rand() * 96,
      top: 2 + rand() * 84,
      width: 15 + rand() * 24,
      tilt: (rand() - 0.5) * 18,
      dim: 0.022 + rand() * 0.026,
      facing: rand() > 0.5 ? 'left' : 'right',
    }))
  }, [seed, count])

  return (
    <div className={`cloud-field ${className}`.trim()} aria-hidden="true">
      {drift.map((c, i) => (
        <span
          key={i}
          className="cloud-field__one"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: `${c.width}vw`,
            opacity: c.dim,
            transform: `rotate(${c.tilt}deg)`,
          }}
        >
          <Cloud facing={c.facing} />
        </span>
      ))}
    </div>
  )
}

/* ── Con nghê ────────────────────────────────────────────────────────── */
const NGHE = `M74 118C74 108 73 96 72 88C71 80 72 72 76 66C79 62 83 59 87 58
C89 55 92 53 96 53C99 53 101 55 103 53C105 51 106 47 104 44C102 41 99 40 96 40
C97 36 96 32 93 29C95 24 94 19 90 15C90 20 88 24 85 26C86 21 84 17 80 15
C80 20 78 24 75 27C71 29 68 32 66 36C70 39 69 44 65 46C61 48 58 51 57 55
C61 57 60 62 56 64C52 66 49 69 48 73C52 75 50 80 46 82C40 85 35 87 31 91
C33 82 33 72 29 64C26 58 20 54 14 55C19 59 21 64 20 69C16 71 13 76 14 81
C17 79 21 79 24 81C20 84 17 88 17 94C17 102 20 110 26 116C28 118 30 119 32 119Z`

/**
 * Con nghê — the Vietnamese guardian: leaner than the Chinese lion, dog-like,
 * a mane running down its chest and a plume of a tail, sitting up on a plinth.
 * A pair face each other across whatever they are guarding.
 */
export function Nghe({ facing = 'right', className = '' }) {
  const mask = `nghe-${useId().replace(/:/g, '')}`
  return (
    <span className={`nghe ${className}`.trim()} data-facing={facing} aria-hidden="true">
      <svg viewBox="0 0 110 132" role="presentation" focusable="false">
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="110" height="132">
          <rect width="110" height="132" fill="#000" />
          <g fill="#fff">
            <path d={NGHE} />
            {/* bệ đá */}
            <rect x="12" y="117" width="86" height="6" rx="1.5" />
            <rect x="17" y="125" width="76" height="4" rx="1" />
          </g>
          {/* miệng, và đường tách chân trước khỏi thân — cắt lõm vào */}
          <g fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round">
            <path d="M92 53c4 1 8 0 10-2" />
            <path d="M72 88c-7 5-13 11-16 18" />
            <path d="M38 99c7 2 13 6 17 12" strokeWidth="1.8" />
          </g>
          <circle cx="95" cy="45" r="2.1" fill="#000" />
        </mask>
        <rect className="nghe__ink" width="110" height="132" mask={`url(#${mask})`} />
      </svg>
    </span>
  )
}

/* ── Khung ───────────────────────────────────────────────────────────── */
/**
 * The frame around a chapter's photographs.
 *
 * Two rules with a hair's gap between them — the way a carved panel is
 * bordered, never one heavy line — and a small hồi văn key cut into each
 * corner, the same figure that sits inside the seal. It is drawn outside the
 * photographs and never touches them: a frame that overlaps its picture is a
 * frame that is competing with it.
 */
const CORNERS = ['tl', 'tr', 'bl', 'br']
const SPIN = { tl: 0, tr: 90, br: 180, bl: 270 }

export function OrnFrame({ className = '' }) {
  return (
    <div className={`ornframe ${className}`.trim()} aria-hidden="true">
      {CORNERS.map((at) => (
        <span key={at} className="ornframe__corner" data-at={at}>
          <svg viewBox="0 0 34 34" role="presentation" focusable="false">
            <g transform={`rotate(${SPIN[at]} 17 17)`}>
              <path d="M2 33V8a6 6 0 0 1 6-6h25" />
              <path d="M12 33V16a4 4 0 0 1 4-4h17" strokeWidth="0.9" opacity="0.75" />
              <path d="M20 33v-9h9" strokeWidth="0.9" opacity="0.75" />
            </g>
          </svg>
        </span>
      ))}
    </div>
  )
}
