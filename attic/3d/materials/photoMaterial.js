import * as THREE from 'three'

/**
 * Every photograph in the space is drawn with this one material.
 *
 * It does four things a plain map-on-a-plane cannot:
 *   1. cover-fits the image to the plane, so no frame is ever distorted
 *   2. dissolves its own edges — a photograph should read as light on a wall,
 *      not as a card floating in a game engine
 *   3. carries grain and a distance falloff, which is what makes the room feel
 *      like a room rather than a black background
 *   4. wipes itself in on arrival instead of popping
 */
const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uSway;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vec3 p = position;
    // Barely-there breathing. At uSway = 0 this compiles away to nothing.
    p.z += sin(uTime * 0.17 + uPhase + uv.y * 2.0) * uSway;
    p.x += cos(uTime * 0.11 + uPhase) * uSway * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uGrain;
  uniform float uTime;
  uniform float uPresence;
  uniform float uPlaneRatio;
  uniform float uImageRatio;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uEdge;
  uniform float uFlip;
  varying vec2 vUv;
  varying float vDepth;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    // cover-fit
    vec2 f = uPlaneRatio > uImageRatio
      ? vec2(1.0, uImageRatio / uPlaneRatio)
      : vec2(uPlaneRatio / uImageRatio, 1.0);
    vec2 uv = (vUv - 0.5) * f + 0.5;
    uv.y = mix(uv.y, 1.0 - uv.y, uFlip);

    vec3 col = texture2D(uMap, uv).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));

    // Dormant frames sit back in the dark — desaturated and dimmed, not hidden.
    col = mix(vec3(lum), col, mix(0.5, 1.0, uPresence));
    col *= mix(0.38, 1.0, uPresence);

    // Grain belongs in the midtones. Pushed into the shadows it stops reading
    // as film and starts reading as compression noise.
    float g = hash(gl_FragCoord.xy + fract(uTime * 0.7) * 137.0) - 0.5;
    col += g * uGrain * (1.0 - abs(lum - 0.45) * 1.35);

    vec2 e = smoothstep(0.0, uEdge, vUv) * smoothstep(1.0, 1.0 - uEdge, vUv);
    float edge = e.x * e.y;

    float wipe = clamp((uReveal * 1.45 - (1.0 - vUv.y)) * 2.4, 0.0, 1.0);
    float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);

    // A reflection fades away from the plate it belongs to.
    float alpha = uOpacity * edge * wipe * fog * mix(1.0, smoothstep(-0.1, 0.85, vUv.y), uFlip);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);

    // A raw ShaderMaterial gets none of three's output pipeline for free —
    // without this the whole exhibition renders about two stops under.
    #include <colorspace_fragment>
  }
`

export function createPhotoMaterial({ grain = 0.024, sway = 0, phase = 0, edge = 0.035 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uMap: { value: null },
      uOpacity: { value: 1 },
      uReveal: { value: 0 },
      uGrain: { value: grain },
      uTime: { value: 0 },
      uPresence: { value: 0.4 },
      uPlaneRatio: { value: 0.75 },
      uImageRatio: { value: 0.75 },
      uFogNear: { value: 34 },
      uFogFar: { value: 78 },
      uEdge: { value: edge },
      uFlip: { value: 0 },
      uSway: { value: sway },
      uPhase: { value: phase },
    },
  })
}
