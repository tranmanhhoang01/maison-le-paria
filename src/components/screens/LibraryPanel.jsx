import { openViewer } from '../../store/experience.js'

/**
 * The library. Where the universe is for finding a photograph, this is for
 * looking at one.
 *
 * Every frame is shown whole and shown large — a landscape fills the width of
 * the page, a portrait fills the height of the screen. Nothing is cropped to
 * a square, nothing is shrunk to fit a column, and nothing dims when you look
 * at it. The page simply gets out of the way.
 */
function Frame({ image, set }) {
  return (
    <figure
      className="frame"
      // A landscape is limited by the width of the page, a portrait by the
      // height of the screen. One rule cannot serve both without shrinking
      // one of them, so each is told which it is.
      data-orient={image.ratio >= 1.15 ? 'wide' : 'tall'}
      style={{ '--ratio': image.ratio, backgroundImage: `url(${image.lqip})` }}
    >
      <button
        className="frame__open"
        onClick={() => openViewer(image)}
        aria-label={`Mở toàn màn hình — ${set.title}, ảnh ${image.number}`}
      >
        <img
          src={image.full}
          srcSet={`${image.wide} 1600w, ${image.full} 2400w`}
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

export function LibraryPanel({ sets }) {
  return (
    <article className="panel panel--library" data-in="true">
      <div className="library">
        <header className="library__head">
          <p className="panel__eyebrow micro lift">THƯ VIỆN</p>
          <p className="library__count micro lift">
            {sets.reduce((n, s) => n + s.images.length, 0)} ẢNH — {sets.length} BỘ
          </p>
        </header>

        {sets.map((set) => (
          <section key={set.id} className="series">
            <header className="series__head">
              <span className="series__num micro">{set.number}</span>
              <h2 className="series__title serif">{set.title}</h2>
              <p className="series__sub meta">{set.subtitle}</p>
              <p className="series__note">{set.description}</p>
            </header>

            {set.images.map((image) => (
              <Frame key={image.id} image={image} set={set} />
            ))}
          </section>
        ))}

        <footer className="library__foot">
          <p className="serif">MAISON LE PARIA</p>
          <p className="micro">{sets[0]?.year ?? ''}</p>
        </footer>
      </div>
    </article>
  )
}
