import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { createPhotoMaterial } from './materials/photoMaterial.js'
import { loadTexture, retain, release, prefetch } from '../../lib/textures.js'
import { damp, clamp, smoothstep } from '../../lib/math.js'
import { setCursor } from '../../store/experience.js'

/**
 * One photograph, hanging in space.
 *
 * Loading is distance-driven: the 20-byte blur is decoded immediately, the
 * 640px thumbnail only once the camera is within `radius`, and the 1800px
 * original is merely hinted to the browser when you get close enough to
 * plausibly click it. Nothing is fetched for a room you never walked into.
 */
export function PhotoPlane({
  image,
  position,
  rotation = [0, 0, 0],
  size,
  sway = 0,
  phase = 0,
  grain = 0.024,
  radius = 62,
  presence,          // number, or a function evaluated per frame, 0–1
  opacity = 1,
  flip = false,      // draws the plate as its own reflection
  interactive = false,
  onSelect,
  cursor = 'view',
}) {
  const mesh = useRef()
  const requested = useRef(false)
  const hinted = useRef(false)
  const loadedUrl = useRef(null)
  const hover = useRef(0)
  const reveal = useRef(0)
  const hasPixels = useRef(false)

  const material = useMemo(
    () => createPhotoMaterial({ grain, sway, phase }),
    [grain, sway, phase],
  )

  const planeRatio = size[0] / size[1]

  useEffect(() => {
    material.uniforms.uPlaneRatio.value = planeRatio
    material.uniforms.uImageRatio.value = image.ratio ?? planeRatio
    material.uniforms.uOpacity.value = opacity
    material.uniforms.uFlip.value = flip ? 1 : 0
  }, [material, planeRatio, image.ratio, opacity, flip])

  // A plane can be handed a different photograph (a room re-layout, a new
  // project); without this it would keep showing the previous one for ever.
  useEffect(() => {
    requested.current = false
    hinted.current = false
    if (loadedUrl.current && loadedUrl.current !== image.thumb) {
      release(loadedUrl.current)
      loadedUrl.current = null
    }
  }, [image.thumb])

  // The blur is a data URI: no request, no waiting, no empty rectangle.
  useEffect(() => {
    let cancelled = false
    loadTexture(image.lqip).then((texture) => {
      if (cancelled) { release(image.lqip); return }
      retain(image.lqip)
      if (loadedUrl.current) return
      material.uniforms.uMap.value = texture
      hasPixels.current = true
    }).catch(() => {})
    return () => { cancelled = true; release(image.lqip) }
  }, [image.lqip, material])

  useEffect(() => () => {
    if (loadedUrl.current) release(loadedUrl.current)
    material.dispose()
  }, [material])

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const distance = Math.abs(camera.position.z - position[2])

    if (!requested.current && distance < radius) {
      requested.current = true
      loadTexture(image.thumb)
        .then((texture) => {
          material.uniforms.uMap.value = texture
          loadedUrl.current = image.thumb
          hasPixels.current = true
          retain(image.thumb)
        })
        .catch(() => { requested.current = false })
    }
    if (!hinted.current && distance < 18) {
      hinted.current = true
      prefetch(image.full)
    }

    const u = material.uniforms
    u.uTime.value = clock.elapsedTime

    reveal.current = damp(reveal.current, hasPixels.current ? 1 : 0, 1.5, dt)
    u.uReveal.value = reveal.current

    // Presence: how "lit" this frame is. Near the camera it is fully itself;
    // far away it recedes into grey. Hovering lifts it slightly early.
    const natural = 0.32 + 0.68 * (1 - smoothstep(10, 46, distance))
    const forced = typeof presence === 'function' ? presence() : presence
    const target = clamp((forced ?? natural) + hover.current * 0.22)
    u.uPresence.value = damp(u.uPresence.value, target, 2.2, dt)

    if (mesh.current) {
      const lift = hover.current * 0.05
      mesh.current.scale.setScalar(damp(mesh.current.scale.x, 1 + lift, 3, dt))
    }
  })

  const handlers = interactive
    ? {
        onPointerOver: (e) => { e.stopPropagation(); hover.current = 1; setCursor(cursor) },
        onPointerOut: () => { hover.current = 0; setCursor('idle') },
        onClick: (e) => { e.stopPropagation(); onSelect?.() },
      }
    : {}

  return (
    <mesh ref={mesh} position={position} rotation={rotation} material={material} {...handlers}>
      <planeGeometry args={[size[0], size[1], 1, sway ? 8 : 1]} />
    </mesh>
  )
}
