import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PhotoPlane } from './PhotoPlane.jsx'
import { corridorLayout, CORRIDOR } from '../../lib/spatial.js'
import { setFocus } from '../../store/experience.js'
import { smoothstep } from '../../lib/math.js'
import { scroll } from '../../lib/scrollState.js'

/**
 * The universe: an entrance plate, then one door per project, staggered along
 * a path the camera walks down. Each door is a photograph — the cover of the
 * world behind it — and it lights up as you draw level with it.
 */
export function Corridor({ projects, tier, onEnter, hero, length, start = 4 }) {
  const layout = useMemo(() => corridorLayout(projects, tier), [projects, tier])
  const current = useRef(-1)
  const reflections = tier.name === 'high'

  useFrame(() => {
    // Which door am I level with? Measured against where the scroll is going,
    // not where the camera has got to — the label should lead the inertia,
    // otherwise a fast scroll leaves the wrong name on screen.
    const z = start - scroll.progress * length
    let nearest = 0
    let best = Infinity
    for (let i = 0; i < layout.length; i++) {
      const d = Math.abs(z - layout[i].position[2])
      if (d < best) { best = d; nearest = i }
    }
    const focus = best < 26 ? nearest : -1
    if (focus !== current.current) {
      current.current = focus
      setFocus(focus)
    }
  })

  return (
    <group>
      {hero && <HeroPlate image={hero} tier={tier} />}

      {layout.map((door, i) => (
        <group key={door.project.id}>
          <PhotoPlane
            image={door.project.coverImage}
            position={door.position}
            rotation={door.rotation}
            size={door.size}
            sway={tier.sway * 0.6}
            phase={i * 1.7}
            interactive
            cursor="enter"
            onSelect={() => onEnter(door.project, door)}
          />
          {reflections && (
            <PhotoPlane
              image={door.project.coverImage}
              position={[door.position[0], door.position[1] - door.size[1] - 0.14, door.position[2]]}
              rotation={door.rotation}
              size={door.size}
              flip
              opacity={0.13}
              grain={0.02}
            />
          )}
        </group>
      ))}
    </group>
  )
}

/**
 * The entrance object. Not a logo and not a slideshow: one large plate with
 * two fragments of the same world set behind it, so the very first thing the
 * eye does on this site is read depth.
 */
function HeroPlate({ image, tier }) {
  const wide = tier.name === 'low' || tier.name === 'medium'
  const h = wide ? 5.2 : 7.2
  const ratio = image.ratio ?? 0.75
  const z = CORRIDOR.entry

  // The wordmark owns the first screen, so the plate holds itself back and
  // only comes up to full light as the type dissolves on the first scroll.
  const presence = () => 0.44 + 0.56 * smoothstep(0.004, 0.055, scroll.progress)

  return (
    <group>
      <PhotoPlane
        image={image}
        position={[0, wide ? 0.1 : 0, z]}
        size={[h * ratio, h]}
        sway={tier.sway}
        grain={0.05}
        radius={140}
        presence={presence}
      />
      {!wide && (
        <>
          <PhotoPlane
            image={image}
            position={[-3.6, 0.9, z - 7]}
            rotation={[0, 0.28, 0.01]}
            size={[2.5 * ratio, 2.5]}
            opacity={0.5}
            grain={0.03}
            sway={tier.sway * 1.6}
            phase={2.1}
            radius={140}
          />
          <PhotoPlane
            image={image}
            position={[4.1, -1.1, z - 12]}
            rotation={[0, -0.32, -0.015]}
            size={[1.9 * ratio, 1.9]}
            opacity={0.32}
            grain={0.03}
            sway={tier.sway * 2}
            phase={4.4}
            radius={140}
          />
        </>
      )}
      {tier.name === 'high' && (
        <PhotoPlane
          image={image}
          position={[0, -h - 0.16, z]}
          size={[h * ratio, h]}
          flip
          opacity={0.15}
          grain={0.02}
          radius={140}
        />
      )}
    </group>
  )
}
