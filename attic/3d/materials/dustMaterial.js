import * as THREE from 'three'

/**
 * Dust, not stars. The particles wrap around the camera in shader space so the
 * field is infinite without ever allocating more than `count` points, and they
 * drift at a fraction of camera speed so depth reads as depth.
 */
const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uCamZ;
  uniform float uRange;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aScale;
  attribute float aPhase;
  varying float vFade;

  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.06 + aPhase) * 1.4;
    p.y += cos(uTime * 0.045 + aPhase * 1.7) * 1.1;
    // Wrap into the volume just ahead of the camera.
    p.z = uCamZ - mod(position.z - uCamZ * 0.42, uRange);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    vFade = smoothstep(0.5, 6.0, dist) * (1.0 - smoothstep(uRange * 0.45, uRange * 0.95, dist));
    gl_PointSize = uSize * aScale * uPixelRatio * (12.0 / max(dist, 1.0));
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.06, d) * vFade * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

export function createDustMaterial({ color = '#cdc4b4', opacity = 0.5, size = 1.6 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCamZ: { value: 0 },
      uRange: { value: 170 },
      uSize: { value: size },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
  })
}
