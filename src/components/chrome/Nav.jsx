import { useEffect, useState } from 'react'
import { site } from '../../data/site.js'
import { useRoute } from '../../lib/router.js'
import { travelTo } from '../../lib/transition.js'
import { useExperience } from '../../store/experience.js'
import { SoundToggle } from './SoundToggle.jsx'

/**
 * Deliberately almost nothing: a name, four words, a speaker. It dims to a
 * whisper whenever an image takes the screen.
 */
export function Nav() {
  const route = useRoute()
  const viewer = useExperience((s) => s.viewer)
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [route.path])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const go = (e, path) => { e.preventDefault(); travelTo(path) }
  const isCurrent = (path) => (path === '/' ? route.name === 'universe' : route.path === path)

  return (
    <>
      <header className="nav" data-hidden={!!viewer} data-open={open}>
        <a className="nav__mark" href="/" onClick={(e) => go(e, '/')} aria-label={site.name}>
          {site.name}
        </a>

        <nav className="nav__links" aria-label="Chính">
          {site.nav.map((item) => (
            <a
              key={item.path}
              className="nav__link meta"
              href={item.path}
              data-current={isCurrent(item.path)}
              onClick={(e) => go(e, item.path)}
            >
              {item.label}
            </a>
          ))}
          <SoundToggle />
        </nav>

        <button
          className="nav__burger"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span /><span />
        </button>
      </header>

      <div className="menu" data-open={open} aria-hidden={!open}>
        <div className="menu__inner" data-in={open}>
          {site.nav.map((item) => (
            <a
              key={item.path}
              className="menu__link serif lift"
              href={item.path}
              onClick={(e) => go(e, item.path)}
            >
              {item.label}
            </a>
          ))}
          <div className="menu__foot lift">
            <SoundToggle />
          </div>
        </div>
      </div>
    </>
  )
}
