import * as THREE from 'three'

/**
 * A texture cache with a strict budget.
 *
 * A photography site will happily allocate a gigabyte of VRAM if you let it.
 * Textures are shared by URL, reference-counted by the planes using them, and
 * the least-recently-released ones are disposed once we exceed the budget.
 */
const loader = new THREE.TextureLoader()
const cache = new Map()          // url → { texture, refs, released }
const inflight = new Map()       // url → Promise
const BUDGET = 64

let anisotropy = 4
export function setAnisotropy(value) { anisotropy = value }

function prepare(texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function evict() {
  if (cache.size <= BUDGET) return
  const disposable = [...cache.entries()]
    .filter(([, e]) => e.refs === 0)
    .sort((a, b) => a[1].released - b[1].released)
  for (const [url, entry] of disposable) {
    if (cache.size <= BUDGET) break
    entry.texture.dispose()
    cache.delete(url)
  }
}

export function loadTexture(url) {
  const hit = cache.get(url)
  if (hit) return Promise.resolve(hit.texture)
  if (inflight.has(url)) return inflight.get(url)

  const promise = new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        prepare(texture)
        cache.set(url, { texture, refs: 0, released: performance.now() })
        inflight.delete(url)
        evict()
        resolve(texture)
      },
      undefined,
      (err) => { inflight.delete(url); reject(err) },
    )
  })
  inflight.set(url, promise)
  return promise
}

export function retain(url) { const e = cache.get(url); if (e) e.refs += 1 }
export function release(url) {
  const e = cache.get(url)
  if (!e) return
  e.refs = Math.max(0, e.refs - 1)
  if (e.refs === 0) e.released = performance.now()
  evict()
}

/** Warms the browser cache without touching GL — used for the next frames. */
export function prefetch(url) {
  if (cache.has(url) || inflight.has(url)) return
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}
