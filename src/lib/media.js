/**
 * The single seam between the app and wherever the photographs live.
 *
 * Today every path in generated/images.json is served from /public/images.
 * To move the archive onto Cloudflare R2, Supabase Storage, Cloudinary or a
 * headless CMS, set VITE_MEDIA_BASE (and, if the host supports on-the-fly
 * resizing, swap `transform` below). No component changes.
 *
 *   VITE_MEDIA_BASE=https://media.maisonleparia.com
 */
const BASE = (import.meta.env?.VITE_MEDIA_BASE ?? '/images').replace(/\/$/, '')

export const mediaUrl = (relativePath) => `${BASE}/${relativePath}`

/**
 * Optional width hint. Local files are pre-rendered at fixed sizes so this is
 * a no-op; a provider like Cloudinary would return `.../w_${width}/${path}`.
 */
export const mediaUrlAt = (relativePath, _width) => mediaUrl(relativePath)
