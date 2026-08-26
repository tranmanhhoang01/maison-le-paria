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
/**
 * Note the BASE_URL: on GitHub Pages this site lives under /<tên-repo>/, and a
 * hard-coded '/images' would ask the server for a path one level above the
 * site — every photograph 404s and the page falls back to its blur.
 */
const BASE = (import.meta.env?.VITE_MEDIA_BASE ?? `${import.meta.env.BASE_URL}images`)
  .replace(/\/$/, '')

export const mediaUrl = (relativePath) => `${BASE}/${relativePath}`

/**
 * Optional width hint. Local files are pre-rendered at fixed sizes so this is
 * a no-op; a provider like Cloudinary would return `.../w_${width}/${path}`.
 */
export const mediaUrlAt = (relativePath, _width) => mediaUrl(relativePath)
