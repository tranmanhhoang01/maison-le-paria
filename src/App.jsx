import { useEffect, useMemo, useState } from 'react'

import { photos, sets } from './data/projects.js'
import { site } from './data/site.js'
import { useRoute } from './lib/router.js'
import { useExperience, closeViewer, setSound } from './store/experience.js'
import { startSound, soundAllowed } from './audio/sound.js'

import { Universe } from './components/universe/Universe.jsx'
import { FocusLabel } from './components/universe/FocusLabel.jsx'
import { Nav } from './components/chrome/Nav.jsx'
import { Intro } from './components/chrome/Intro.jsx'
import { Curtain } from './components/chrome/Curtain.jsx'
import { AboutPanel } from './components/screens/AboutPanel.jsx'
import { ContactPanel } from './components/screens/ContactPanel.jsx'
import { LibraryPanel } from './components/screens/LibraryPanel.jsx'
import { Viewer } from './components/viewer/Viewer.jsx'

const PANELS = { about: AboutPanel, contact: ContactPanel, library: LibraryPanel }

/**
 * The compact hang is for small screens, and only for small screens.
 *
 * It used to trigger on a coarse pointer as well, which put a 1280px touch
 * laptop — and any browser that merely reports touch capability — into the
 * phone layout at two thirds scale.
 */
const isCompact = () => {
  if (typeof window === 'undefined') return false
  const w = window.innerWidth
  // A width of zero means the window has not been measured yet, not that the
  // screen is tiny. Guessing "phone" there locks the roomy hang out of a
  // desktop browser until something happens to fire a resize.
  return w > 0 && w < 820
}

function useCompact() {
  const [compact, setCompact] = useState(isCompact)
  useEffect(() => {
    let t
    const on = () => {
      clearTimeout(t)
      t = setTimeout(() => setCompact(isCompact()), 200)
    }
    window.addEventListener('resize', on)
    return () => { clearTimeout(t); window.removeEventListener('resize', on) }
  }, [])
  return compact
}

export default function App() {
  const route = useRoute()
  const compact = useCompact()
  const viewer = useExperience((s) => s.viewer)
  const Panel = PANELS[route.name]

  useEffect(() => { closeViewer() }, [route.path])

  /**
   * Sound cannot start before the visitor has touched the page — every
   * browser refuses, and quite rightly. So it starts at the first gesture,
   * whichever it turns out to be: clicking into the opening screen, dragging
   * the field, opening a photograph, pressing a key.
   */
  useEffect(() => {
    if (!soundAllowed()) return
    let done = false
    const open = async () => {
      if (done) return
      // Only stand down once it actually worked: a key the browser does not
      // accept as permission must not use up our one attempt.
      if (!(await startSound())) return
      done = true
      setSound(true)
      events.forEach((e) => window.removeEventListener(e, open))
    }
    const events = ['pointerdown', 'keydown', 'touchend']
    events.forEach((e) => window.addEventListener(e, open, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, open))
  }, [])

  useEffect(() => {
    document.title =
      route.name === 'about' ? `Giới thiệu — ${site.name}`
      : route.name === 'contact' ? `Liên hệ — ${site.name}`
      : route.name === 'library' ? `Thư viện — ${site.name}`
      : `${site.name} — Nhiếp ảnh / Nghệ thuật / Ký ức`
  }, [route.name])

  const openSets = useMemo(() => sets, [])

  return (
    <>
      {/* Ở đây từng có một lớp bụi vẽ trên canvas mỗi khung hình. Nó tốn
          đúng thứ mà màn 120Hz không có nhiều: thời gian trong mỗi khung
          hình. Vân giấy đã đủ không khí — xem chrome/Dust.jsx nếu muốn
          mang lại. */}
      <Universe sets={sets} compact={compact} active={!Panel && !viewer} />
      <FocusLabel />

      {Panel && (
        <div className="panel-layer">
          <div className="panel-layer__scrim sheet" />
          <Panel sets={openSets} />
        </div>
      )}

      <Nav />
      <Viewer />
      <Curtain />
      <Intro count={photos.length} />
      {!!viewer && <div className="viewer-lock" aria-hidden="true" />}
    </>
  )
}
