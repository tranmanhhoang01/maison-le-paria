import { useExperience, setSound } from '../../store/experience.js'
import { startSound, stopSound, rememberSound } from '../../audio/sound.js'

/**
 * The room has sound, and the visitor decides. The choice is remembered, so
 * someone who turned it off once is not asked again on their next visit.
 */
export function SoundToggle() {
  const sound = useExperience((s) => s.sound)

  const flip = async () => {
    if (sound) {
      stopSound()
      rememberSound(false)
      setSound(false)
    } else {
      rememberSound(true)
      // A click is a gesture, so this always works.
      if (await startSound()) setSound(true)
    }
  }

  return (
    <button className="sound meta" onClick={flip} aria-pressed={sound}>
      <span className="sound__bars" data-on={sound}>
        <i /><i /><i />
      </span>
      ÂM THANH {sound ? 'BẬT' : 'TẮT'}
    </button>
  )
}
