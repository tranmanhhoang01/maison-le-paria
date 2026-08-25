import { useSyncExternalStore } from 'react'

/**
 * Discrete state only. Everything that changes per frame — the pointer, the
 * pan of the plane, the scale of every tile — is written straight to the DOM
 * inside Universe's animation frame and never touches React.
 */
const initial = {
  focusPhoto: null,      // the photograph the pointer is currently over
  viewer: null,          // { index } into the flat photo list
  sound: false,          // đang phát hay không (khác với 'được phép phát')
  curtain: null,         // null | 'cover' | 'reveal' — the between-pages screen
}

let state = initial
const listeners = new Set()

const set = (patch) => {
  const next = typeof patch === 'function' ? patch(state) : patch
  let changed = false
  for (const k in next) if (state[k] !== next[k]) { changed = true; break }
  if (!changed) return
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const experience = {
  get: () => state,
  set,
  subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
}

export function useExperience(selector = (s) => s) {
  return useSyncExternalStore(experience.subscribe, () => selector(state), () => selector(initial))
}

/* ── Intentions ─────────────────────────────────────────────────────── */
export const setFocusPhoto = (focusPhoto) => set({ focusPhoto })
export const openViewer = (photo) => set({ viewer: { photo } })
export const closeViewer = () => set({ viewer: null })
export const setCurtain = (curtain) => set({ curtain })
export const setSound = (sound) => set({ sound })
