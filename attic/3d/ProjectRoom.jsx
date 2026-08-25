import { useMemo } from 'react'
import { PhotoPlane } from './PhotoPlane.jsx'
import { roomLayout } from '../../lib/spatial.js'
import { openViewer } from '../../store/experience.js'

/**
 * A project space. The photographs are hung along the path at varying depth
 * and scale, with every third frame stepping into the centre as a beat.
 * The last thing in the room is the door to the next project.
 */
export function ProjectRoom({ project, tier, next, onNext }) {
  const layout = useMemo(() => roomLayout(project.images, tier), [project, tier])
  const end = layout[layout.length - 1]?.position[2] ?? -60
  const wide = tier.name === 'low' || tier.name === 'medium'

  return (
    <group>
      {layout.map((frame, i) => (
        <PhotoPlane
          key={frame.image.id}
          image={frame.image}
          position={frame.position}
          rotation={frame.rotation}
          size={frame.size}
          sway={tier.sway * frame.drift}
          phase={frame.phase}
          interactive
          cursor="view"
          onSelect={() => openViewer(project, i)}
        />
      ))}

      {next && (
        <PhotoPlane
          image={next.coverImage}
          position={[0, 0, end - 22]}
          size={[(wide ? 4.6 : 5.6) * (next.coverImage.ratio ?? 0.75), wide ? 4.6 : 5.6]}
          sway={tier.sway * 0.5}
          interactive
          cursor="enter"
          onSelect={() => onNext(next)}
        />
      )}
    </group>
  )
}
