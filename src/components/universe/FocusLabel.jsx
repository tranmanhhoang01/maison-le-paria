import { useExperience } from '../../store/experience.js'

/**
 * The wall label. One at a time, for whichever photograph the pointer is on —
 * which is why nothing else on this screen needs a caption.
 */
export function FocusLabel() {
  const photo = useExperience((s) => s.focusPhoto)
  return (
    <div className="label" data-on={!!photo} aria-live="polite">
      <span className="label__set serif">{photo?.setTitle ?? ''}</span>
      <span className="label__meta micro">
        {photo ? `${photo.setSubtitle} — ${photo.number}` : ''}
      </span>
    </div>
  )
}
