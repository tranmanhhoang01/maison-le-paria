import { Suspense, useEffect, useState } from 'react'
import { Canvas, advance } from '@react-three/fiber'
import * as THREE from 'three'
import { Dust } from './Dust.jsx'
import { CameraRig } from './CameraRig.jsx'
import { Corridor } from './Corridor.jsx'
import { ProjectRoom } from './ProjectRoom.jsx'
import { setAnisotropy } from '../../lib/textures.js'

/**
 * A single canvas for the entire site. Rooms are swapped inside it while a
 * black veil is drawn over the top, so the WebGL context — the expensive
 * thing — is created exactly once per visit.
 */
export function Stage({ tier, scene, projects, project, next, hero, length, onEnter, onNext }) {
  // A browser can drop a GL context at any time — a laptop waking from sleep,
  // too many tabs, a driver reset. Remounting the canvas rebuilds the room
  // rather than leaving the visitor staring at a black rectangle.
  const [generation, setGeneration] = useState(0)
  const [canvas, setCanvas] = useState(null)

  useEffect(() => {
    if (!canvas) return
    const onLost = (e) => { e.preventDefault(); setTimeout(() => setGeneration((g) => g + 1), 400) }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [canvas])

  return (
    <Canvas
      key={generation}
      className="stage"
      // R3F writes position/width/height inline, so the fixed layer has to be
      // declared here rather than in the stylesheet.
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
      dpr={[1, Math.min(tier.dpr, window.devicePixelRatio || 1)]}
      gl={{
        antialias: tier.antialias,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      camera={{ fov: 38, near: 0.1, far: 260, position: [0, 0, 4] }}
      onCreated={({ gl, scene, camera }) => {
        setCanvas(gl.domElement)
        if (import.meta.env.DEV) window.__three = { gl, scene, camera, advance }
        gl.setClearColor(new THREE.Color('#08090a'), 1)
        setAnisotropy(Math.min(gl.capabilities.getMaxAnisotropy(), tier.name === 'high' ? 8 : 2))
      }}
    >
      <CameraRig length={length} />
      <Dust count={tier.dust} opacity={scene === 'project' ? 0.36 : 0.5} />
      <Suspense fallback={null}>
        {scene === 'universe' ? (
          <Corridor projects={projects} tier={tier} hero={hero} length={length} onEnter={onEnter} />
        ) : project ? (
          <ProjectRoom project={project} tier={tier} next={next} onNext={onNext} />
        ) : null}
      </Suspense>
    </Canvas>
  )
}
