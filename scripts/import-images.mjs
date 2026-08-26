#!/usr/bin/env node
/**
 * Maison Le Paria — image pipeline.
 *
 * Points at one folder (`root`). Every sub-folder inside it becomes a set in
 * the constellation; drop a new folder in, re-run, and the universe grows.
 * Nothing is listed by hand.
 *
 * Three renditions per photograph:
 *   tile  1000px — what hangs in the universe. Sized so a magnified tile on a
 *                  2× screen is still sampling more pixels than it draws.
 *   wide  1600px — what the library shows. Without this middle step a phone
 *                  would have to choose between a soft 1000px and a 1mb 2400px.
 *   full  2400px — what opens when you click, and what deep zoom swaps in.
 * Plus a 40px blur inlined as base64 (~1kb), so a tile is never an empty
 * rectangle and never a smear either.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'scripts/sources.json'), 'utf8'))

const IMAGE_RE = /\.(jpe?g|png|tiff?|webp)$/i

/** Vietnamese-safe: strips tone marks so "FN Buổi 1" becomes "fn-buoi-1". */
const slugify = (name) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * One folder, one set — and only the files directly inside it.
 *
 * Sub-folders are deliberately ignored. A photographer's set folder usually
 * has working directories inside it (exports for social, crops, raws), and
 * pulling those in silently fills the exhibition with things that were never
 * meant to hang in it.
 */
function imagesIn(dir) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.') && IMAGE_RE.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

/**
 * Perceptual hash (8×8 average). A photographer's folders hold the same frame
 * more than once — an export, a re-edit, a resized copy — and byte size does
 * not catch those. This does.
 */
async function ahash(file) {
  const buf = await sharp(file).rotate().greyscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer()
  const avg = buf.reduce((a, b) => a + b, 0) / buf.length
  let bits = 0n
  for (let i = 0; i < 64; i++) if (buf[i] > avg) bits |= 1n << BigInt(i)
  return bits
}

const hamming = (a, b) => {
  let x = a ^ b, n = 0
  while (x) { n += Number(x & 1n); x >>= 1n }
  return n
}

const outRoot = path.join(root, cfg.outDir)
fs.rmSync(outRoot, { recursive: true, force: true })

// `root` may be written relative to the project, so that copying the whole
// folder to another Mac keeps working. resolve() handles both forms.
const sourceRoot = path.resolve(root, cfg.root)

const folders = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .map((e) => e.name)
  .sort((a, b) => a.localeCompare(b, 'vi'))

const sets = []

for (const folder of folders) {
  const files = imagesIn(path.join(sourceRoot, folder))
  if (!files.length) continue

  const kept = []
  const skipped = []
  for (const file of files) {
    let hash
    try { hash = await ahash(file) } catch { skipped.push(path.basename(file)); continue }
    if (kept.some((k) => hamming(k.hash, hash) <= 6)) { skipped.push(path.basename(file)); continue }
    kept.push({ file, hash })
  }

  const id = slugify(folder)
  const dir = path.join(outRoot, id)
  fs.mkdirSync(dir, { recursive: true })

  const images = []
  for (const [i, { file: src }] of kept.entries()) {
    const n = String(i + 1).padStart(2, '0')
    const base = `${id}-${n}`
    // .rotate() with no argument bakes in the EXIF orientation — the only
    // reliable way to get upright pixels out the other side.
    const pipeline = sharp(src).rotate()
    const meta = await pipeline.metadata()
    const upright = (meta.orientation ?? 1) >= 5
    const w = upright ? meta.height : meta.width
    const h = upright ? meta.width : meta.height

    await pipeline.clone().resize({ width: cfg.sizes.tile, height: cfg.sizes.tile, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: cfg.quality.tile, effort: 5 }).toFile(path.join(dir, `${base}-tile.webp`))
    await pipeline.clone().resize({ width: cfg.sizes.wide, height: cfg.sizes.wide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: cfg.quality.wide, effort: 5 }).toFile(path.join(dir, `${base}-wide.webp`))
    await pipeline.clone().resize({ width: cfg.sizes.full, height: cfg.sizes.full, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: cfg.quality.full, effort: 5 }).toFile(path.join(dir, `${base}-full.webp`))
    const blur = await pipeline.clone().resize({ width: cfg.sizes.lqip, height: cfg.sizes.lqip, fit: 'inside' })
      .webp({ quality: 52 }).toBuffer()

    images.push({
      id: base,
      tile: `${id}/${base}-tile.webp`,
      wide: `${id}/${base}-wide.webp`,
      full: `${id}/${base}-full.webp`,
      lqip: `data:image/webp;base64,${blur.toString('base64')}`,
      ratio: +(w / h).toFixed(4),
      source: path.basename(src),
    })
  }

  // Recorded so the studio can tell "not processed yet" apart from
  // "processed and deliberately left out as a duplicate".
  sets.push({ id, folder, images, skipped })
  console.log(`  ${folder.padEnd(14)} ${images.length} ảnh${files.length !== images.length ? `  (bỏ ${files.length - images.length} ảnh trùng)` : ''}`)
}

const manifestPath = path.join(root, cfg.manifest)
fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
fs.writeFileSync(manifestPath, JSON.stringify({ sets }, null, 2))
console.log(`\n  tổng ${sets.reduce((n, s) => n + s.images.length, 0)} ảnh → ${cfg.manifest}`)
