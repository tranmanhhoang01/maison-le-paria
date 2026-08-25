import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createDustMaterial } from './materials/dustMaterial.js'
import { mulberry32 } from '../../lib/math.js'

const RANGE = 170

export function Dust({ count = 1200, opacity = 0.5 }) {
  const { viewport } = useThree()
  const material = useMemo(() => createDustMaterial({ opacity }), [opacity])
  const points = useRef()

  const geometry = useMemo(() => {
    const rand = mulberry32(7)
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 60
      positions[i * 3 + 1] = (rand() - 0.5) * 34
      positions[i * 3 + 2] = -rand() * RANGE
      scales[i] = 0.35 + rand() * rand() * 1.6   // squared bias: mostly tiny motes
      phases[i] = rand() * Math.PI * 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)  // never cull
    return g
  }, [count])

  useFrame(({ clock, camera }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uCamZ.value = camera.position.z
    material.uniforms.uRange.value = RANGE
    material.uniforms.uPixelRatio.value = Math.min(viewport.dpr ?? 1, 2)
  })

  if (!count) return null
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
