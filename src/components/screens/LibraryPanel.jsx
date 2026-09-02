import { useEffect } from 'react'

import { openViewer } from '../../store/experience.js'
import { navigate, useRoute, hrefFor } from '../../lib/router.js'
import { useImageReady } from '../../hooks/useImageReady.js'
import { Seal } from '../chrome/Seal.jsx'
import { Clouds, Nghe, Cloud, CloudField } from '../chrome/Ornament.jsx'

/**
 * The library, in two storeys.
 *
 * Downstairs is an index: one frame per series, its story beside it, laid out
 * left, right, left down the page — a scroll you can read rather than a wall
 * of forty photographs you have to wade through to find the second set.
 * Upstairs is one series, whole, at full size.
 *
 * The address changes with the storey (/thu-vien and /thu-vien/<bộ>), so the
 * browser's own back button does the obvious thing and a series can be linked
 * to directly.
 */
function Leaf({ set, at }) {
  const cover = set.covers?.[0] ?? set.images[0]
  const image = useImageReady()
  if (!cover) return null

  return (
    <article className="leaf" data-side={at % 2 ? 'right' : 'left'}>
      <a
        className="leaf__plate"
        href={hrefFor(`/thu-vien/${set.id}`)}
        onClick={(e) => { e.preventDefault(); navigate(`/thu-vien/${set.id}`) }}
        style={{ backgroundImage: `url(${cover.lqip})`, '--ratio': cover.ratio }}
        aria-label={`Xem cả bộ ${set.title}`}
      >
        <img
          src={cover.wide}
          srcSet={cover.srcSet}
          sizes="(max-width: 860px) 100vw, 46vw"
          alt={`${set.title} — ${set.subtitle}`}
          data-loaded={image.ready}
          data-instant={image.instant}
          loading="lazy"
          decoding="async"
          ref={image.catchCached}
          onLoad={image.markReady}
        />
      </a>

      <div className="leaf__text">
        {/* Vân chìm sau tên bộ và câu chuyện. */}
        <Cloud className="cloud--sunk" facing={at % 2 ? 'left' : 'right'} />
        <span className="leaf__num micro">CHƯƠNG {set.number}</span>
        <h2 className="leaf__title serif">{set.title}</h2>
        <div className="meander meander--short leaf__ornament" aria-hidden="true" />
        <p className="leaf__sub meta">{set.subtitle}</p>
        <p className="leaf__note">{set.description}</p>
        <p className="leaf__meta micro">
          {set.location} · {set.year} · {String(set.images.length).padStart(2, '0')} ảnh
        </p>
        <a
          className="leaf__more meta"
          href={hrefFor(`/thu-vien/${set.id}`)}
          onClick={(e) => { e.preventDefault(); navigate(`/thu-vien/${set.id}`) }}
        >
          XEM CẢ BỘ <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  )
}

/**
 * One photograph, whole. A landscape takes the full width of the page; a
 * portrait takes the full height of the screen. Neither is ever cropped to
 * fit a grid, and neither is ever shrunk to match the other.
 */
function Frame({ image, set }) {
  return (
    <figure
      className="frame"
      data-orient={image.ratio >= 1.15 ? 'wide' : 'tall'}
      style={{ '--ratio': image.ratio, backgroundImage: `url(${image.lqip})` }}
    >
      <button
        className="frame__open"
        onClick={() => openViewer(image)}
        aria-label={`Mở toàn màn hình — ${set.title}, ảnh ${image.number}`}
      >
        <img
          src={image.wide}
          srcSet={image.srcSet}
          sizes="(max-width: 860px) 100vw, 1240px"
          alt={`${set.title} — ${set.subtitle}`}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <figcaption className="frame__cap micro">
          <span>{set.title} — {image.number}</span>
          <span className="frame__zoom">XEM TOÀN MÀN HÌNH</span>
        </figcaption>
      </button>
    </figure>
  )
}

function SetView({ set }) {
  const back = (e) => { e?.preventDefault(); navigate('/thu-vien') }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') back() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="library" data-in="true">
      <header className="library__head">
        <a className="library__back micro" href={hrefFor('/thu-vien')} onClick={back}>
          <span aria-hidden="true">←</span> THƯ VIỆN
        </a>
        <p className="library__count micro">{String(set.images.length).padStart(2, '0')} ẢNH</p>
      </header>

      <header className="series__head">
        <Cloud className="cloud--sunk" facing="right" />
        <span className="series__num micro lift">CHƯƠNG {set.number}</span>
        <h1 className="series__title serif lift">{set.title}</h1>
        <div className="meander meander--short lift" aria-hidden="true" />
        <p className="series__sub meta lift">{set.subtitle}</p>
        <p className="series__note lift">{set.description}</p>
        <p className="series__meta micro lift">{set.location} · {set.year}</p>
      </header>

      {set.images.map((image) => (
        <Frame key={image.id} image={image} set={set} />
      ))}

      <footer className="library__foot">
        <a className="library__back micro" href={hrefFor('/thu-vien')} onClick={back}>
          <span aria-hidden="true">←</span> VỀ THƯ VIỆN
        </a>
        <div className="crest">
          <Nghe facing="right" />
          <Seal />
          <Nghe facing="left" />
        </div>
      </footer>
    </div>
  )
}

export function LibraryPanel({ sets }) {
  const route = useRoute()
  const open = route.slug ? sets.find((s) => s.id === route.slug) : null

  // Arriving at a series should start at its first frame, not halfway down
  // wherever the index happened to be scrolled to.
  useEffect(() => { window.scrollTo(0, 0) }, [route.slug])

  return (
    <article className="panel panel--library" data-in="true">
      <CloudField seed={route.slug ? 41 : 17} count={5} className="cloud-field--page" />
      {open ? (
        <SetView set={open} />
      ) : (
        <div className="library">
          <header className="library__head">
            <p className="panel__eyebrow micro lift">THƯ VIỆN</p>
            <p className="library__count micro lift">
              {sets.reduce((n, s) => n + s.images.length, 0)} ẢNH — {sets.length} BỘ
            </p>
          </header>

          <div className="leaves">
            {sets.map((set, i) => (
              <div key={set.id}>
                {i > 0 && <Clouds className="clouds--short leaves__break" />}
                <Leaf set={set} at={i} />
              </div>
            ))}
          </div>

          <footer className="library__foot">
            <p className="serif">MAISON LE PARIA</p>
            <div className="crest">
              <Nghe facing="right" />
              <Seal />
              <Nghe facing="left" />
            </div>
          </footer>
        </div>
      )}
    </article>
  )
}
