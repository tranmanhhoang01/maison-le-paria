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

/**
 * Which of the three renders to ask for, when the exact drawn size is known.
 *
 * `srcset` is the right tool when the layout is fluid and the browser has to
 * guess. The overview is not fluid: PlateCluster works out every photograph's
 * box in pixels, so it can name the file outright — and a file the code asked
 * for by name is a file that can be warmed in advance, which `srcset` makes
 * awkward. The 5% slack keeps a photograph from jumping to the next size up
 * over a rounding error.
 */
export function sourceFor(image, cssWidth, dpr = 1) {
  const need = cssWidth * Math.min(dpr || 1, 2)
  const at = (longest) => (image.ratio >= 1 ? longest : longest * image.ratio)
  if (need <= at(1000) * 1.05) return image.tile
  if (need <= at(1600) * 1.05) return image.wide
  return image.full
}
