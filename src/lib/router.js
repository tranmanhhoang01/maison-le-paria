import { useSyncExternalStore } from 'react'

/**
 * ~40 lines instead of a router dependency. The site has five addresses and
 * no nested layouts; anything larger would be ceremony.
 *
 *   /              the universe
 *   /thu-vien      the library
 *   /gioi-thieu    about
 *   /lien-he       contact
 */
const listeners = new Set()
const EVENT = 'mlp:navigate'

const parse = (pathname) => {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'universe', slug: null, path: '/' }
  // /muc-luc and /tac-pham/* are the old addresses; they still resolve.
  if (parts[0] === 'thu-vien' || parts[0] === 'muc-luc') return { name: 'library', slug: null, path: '/thu-vien' }
  if (parts[0] === 'tac-pham') return { name: 'universe', slug: null, path: '/' }
  if (parts[0] === 'gioi-thieu') return { name: 'about', slug: null, path: pathname }
  if (parts[0] === 'lien-he') return { name: 'contact', slug: null, path: pathname }
  return { name: 'universe', slug: null, path: '/' }
}

let current = typeof window === 'undefined' ? parse('/') : parse(window.location.pathname)

const emit = () => { listeners.forEach((l) => l()) }

export function navigate(path, { replace = false } = {}) {
  if (path === current.path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  current = parse(path)
  emit()
  window.dispatchEvent(new CustomEvent(EVENT, { detail: current }))
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { current = parse(window.location.pathname); emit() })
}

export function useRoute() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
    () => current,
  )
}
