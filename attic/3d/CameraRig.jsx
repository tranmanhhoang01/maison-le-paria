import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from '../../lib/scrollState.js'
import { pointer } from '../../lib/pointerState.js'
import { flight } from '../../lib/flight.js'
import { damp, lerp } from '../../lib/math.js'

/**
 * The only thing that moves the camera.
 *
 * Scroll sets a target depth; the pointer adds a small parallax offset; a
 * flight can take over entirely. Everything is damped rather than assigned,
 * which is what keeps the motion slow and weighted no matter how violently
 * someone throws the scroll wheel.
 */
export function CameraRig({ length, start = 4, sway = true }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 0, -10))

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)

    const scrollZ = start - scroll.progress * length
    const targetZ = lerp(scrollZ, flight.z, flight.active)
    const parallax = 1 - flight.active

    const targetX = lerp(pointer.x * 0.75, flight.x, flight.active) * (parallax || 1)
    const targetY = lerp(-pointer.y * 0.42, flight.y, flight.active) * (parallax || 1)

    camera.position.z = damp(camera.position.z, targetZ, flight.active > 0.01 ? 2.4 : 3.2, dt)
    camera.position.x = damp(camera.position.x, sway ? targetX : 0, 1.6, dt)
    camera.position.y = damp(camera.position.y, sway ? targetY : 0, 1.6, dt)

    // Look slightly further into the room than the pointer suggests, so the
    // head turn always lags the hand — the difference is what reads as weight.
    look.current.x = damp(look.current.x, pointer.x * 1.5 * parallax, 1.1, dt)
    look.current.y = damp(look.current.y, -pointer.y * 0.9 * parallax, 1.1, dt)
    look.current.z = camera.position.z - 12
    camera.lookAt(look.current)

    const targetFov = 38 + flight.fov
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = damp(camera.fov, targetFov, 2.5, dt)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
