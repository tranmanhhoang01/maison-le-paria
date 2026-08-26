#!/usr/bin/env node
/**
 * Maison Le Paria — Studio.
 *
 * A small local control room for the site: add a set, drop photographs into
 * it, rename it, throw one out, then press Deploy. It runs on this machine
 * only and is never part of the published site.
 *
 * Deliberately dependency-free apart from sharp (which the pipeline already
 * uses). Uploads arrive as raw bodies with the filename in the query string,
 * which avoids a multipart parser for no loss of function.
 */
import { createServer } from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'scripts/sources.json'), 'utf8'))
const CATALOGUE = path.join(root, 'content/sets.json')
const SOUND = path.join(root, 'content/sound.json')
// `root` may be relative to the project — see scripts/sources.json.
const ORIGINALS = path.resolve(root, cfg.root)
const PORT = Number(process.env.STUDIO_PORT ?? 5199)

const IMAGE_RE = /\.(jpe?g|png|tiff?|webp)$/i

/* ── helpers ─────────────────────────────────────────────────────────── */

const slugify = (name) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const readCatalogue = () => JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'))
const writeCatalogue = (data) => fs.writeFileSync(CATALOGUE, JSON.stringify(data, null, 2) + '\n')
const readSound = () => JSON.parse(fs.readFileSync(SOUND, 'utf8'))
const writeSound = (data) => fs.writeFileSync(SOUND, JSON.stringify(data, null, 2) + '\n')

const AUDIO_RE = /\.(m4a|mp3|wav|aiff?|aac|flac|caf|ogg)$/i

/** Length and weight of an audio file, for the studio to show. */
function audioInfo(file) {
  if (!fs.existsSync(file)) return null
  try {
    const out = execFileSync('afinfo', [file], { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    const seconds = Number(/estimated duration: ([\d.]+)/.exec(out)?.[1] ?? 0)
    return {
      seconds: Math.round(seconds),
      clock: `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`,
      kb: Math.round(fs.statSync(file).size / 1024),
    }
  } catch { return null }
}

/** Folders live under `ảnh web`; their slug is the id the site knows them by. */
function folders() {
  return fs.readdirSync(ORIGINALS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({ folder: e.name, id: slugify(e.name) }))
}

const folderFor = (id) => folders().find((f) => f.id === id)

function filesIn(folder) {
  const dir = path.join(ORIGINALS, folder)
  try {
    return fs.readdirSync(dir)
      .filter((f) => IMAGE_RE.test(f) && !f.startsWith('.'))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  } catch { return [] }
}

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const body = (req) => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})

/** Runs a command and streams every line to the browser as it happens. */
function stream(res, steps) {
  res.writeHead(200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  const run = ([step, ...rest]) => {
    if (!step) { res.end('\n__DONE__\n'); return }
    const [cmd, args, opts = {}] = step
    res.write(`\n$ ${cmd} ${args.join(' ')}\n`)
    const child = spawn(cmd, args, { cwd: root, env: process.env, ...opts })
    child.stdout.on('data', (d) => res.write(d))
    child.stderr.on('data', (d) => res.write(d))
    child.on('close', (code) => {
      if (code !== 0) { res.end(`\n__FAIL__ (mã lỗi ${code})\n`); return }
      run(rest)
    })
    child.on('error', (err) => res.end(`\n__FAIL__ ${err.message}\n`))
  }
  run(steps)
}

const git = (...args) => new Promise((resolve) => {
  const child = spawn('git', args, { cwd: root })
  let out = ''
  child.stdout.on('data', (d) => { out += d })
  child.stderr.on('data', (d) => { out += d })
  child.on('close', (code) => resolve({ code, out: out.trim() }))
  child.on('error', () => resolve({ code: 1, out: '' }))
})

/* ── state ───────────────────────────────────────────────────────────── */

async function state() {
  const catalogue = readCatalogue()
  let manifest = { sets: [] }
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(root, cfg.manifest), 'utf8'))
  } catch {}

  const published = new Map(manifest.sets.map((s) => [s.id, s]))

  const list = folders().map(({ id, folder }) => {
    const originals = filesIn(folder)
    const entry = published.get(id) ?? { images: [], skipped: [] }
    const live = entry.images ?? []

    // "Pending" means a file the pipeline has never looked at — not one it
    // looked at and deliberately left out as a duplicate.
    const seen = new Set([...live.map((im) => im.source), ...(entry.skipped ?? [])])
    const unseen = originals.filter((f) => !seen.has(f))

    return {
      id,
      folder,
      meta: catalogue.sets?.[id] ?? null,
      originals: originals.length,
      published: live.length,
      pending: unseen.length,
      duplicates: (entry.skipped ?? []).length,
      photos: live.map((im) => ({ id: im.id, thumb: `/images/${im.tile}`, ratio: im.ratio, source: im.source })),
    }
  })

  const order = catalogue.order ?? []
  list.sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
    return (ai === -1 ? 1e9 : ai) - (bi === -1 ? 1e9 : bi)
  })

  const repo = await git('rev-parse', '--is-inside-work-tree')
  const remote = await git('remote', 'get-url', 'origin')
  const status = await git('status', '--porcelain')
  const branch = await git('rev-parse', '--abbrev-ref', 'HEAD')

  const sound = readSound()
  const musicFile = sound.music?.file ? path.join(root, 'public', sound.music.file) : null

  let domain = null
  try { domain = fs.readFileSync(path.join(root, 'public/CNAME'), 'utf8').trim() || null } catch {}

  return {
    sets: list,
    originalsRoot: ORIGINALS,
    domain,
    sound: {
      config: sound,
      music: musicFile ? audioInfo(musicFile) : null,
    },
    git: {
      isRepo: repo.code === 0,
      remote: remote.code === 0 ? remote.out : null,
      branch: branch.code === 0 ? branch.out : null,
      dirty: status.code === 0 ? status.out.split('\n').filter(Boolean).length : 0,
    },
  }
}

/* ── server ──────────────────────────────────────────────────────────── */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const route = url.pathname

  try {
    if (route === '/' || route === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(fs.readFileSync(path.join(root, 'studio/app.html')))
      return
    }

    // Thumbnails come straight from the site's own public folder.
    if (route.startsWith('/images/')) {
      const file = path.join(root, 'public', decodeURIComponent(route))
      if (!file.startsWith(path.join(root, 'public'))) { res.writeHead(403).end(); return }
      if (!fs.existsSync(file)) { res.writeHead(404).end(); return }
      res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-cache' })
      fs.createReadStream(file).pipe(res)
      return
    }

    if (route.startsWith('/audio/')) {
      const file = path.join(root, 'public', decodeURIComponent(route))
      if (!file.startsWith(path.join(root, 'public/audio'))) { res.writeHead(403).end(); return }
      if (!fs.existsSync(file)) { res.writeHead(404).end(); return }
      res.writeHead(200, { 'content-type': 'audio/mp4', 'cache-control': 'no-cache' })
      fs.createReadStream(file).pipe(res)
      return
    }

    if (route === '/api/state') { json(res, 200, await state()); return }

    /* ── Âm thanh ────────────────────────────────────────────────────── */

    if (route === '/api/sound' && req.method === 'POST') {
      const patch = JSON.parse(await body(req))
      const sound = readSound()
      for (const key of ['ambience', 'music']) {
        if (patch[key]) Object.assign(sound[key], patch[key])
      }
      writeSound(sound)
      json(res, 200, { ok: true })
      return
    }

    if (route === '/api/music' && req.method === 'POST') {
      // The Mac app sends a path; the browser sends bytes to a scratch file.
      // Either way the same tested script does the conversion.
      const { path: source } = JSON.parse(await body(req))
      if (!source || !AUDIO_RE.test(source)) { json(res, 400, { error: 'Không phải tệp âm thanh.' }); return }
      if (!fs.existsSync(source)) { json(res, 404, { error: 'Không tìm thấy tệp.' }); return }
      stream(res, [[process.execPath, ['scripts/add-music.mjs', source]]])
      return
    }

    if (route === '/api/music-upload' && req.method === 'POST') {
      const name = path.basename(url.searchParams.get('name') ?? '')
      if (!AUDIO_RE.test(name)) { json(res, 400, { error: `Không nhận tệp ${name}` }); return }
      const scratch = path.join(root, `.tmp-music-${Date.now()}${path.extname(name)}`)
      await fsp.writeFile(scratch, await body(req))
      json(res, 200, { scratch })
      return
    }

    if (route === '/api/music-off' && req.method === 'POST') {
      stream(res, [[process.execPath, ['scripts/add-music.mjs', '--off']]])
      return
    }

    if (route === '/api/set' && req.method === 'POST') {
      const { title, subtitle = '', description = '', year = '', location = '' } = JSON.parse(await body(req))
      if (!title?.trim()) { json(res, 400, { error: 'Cần có tên bộ ảnh.' }); return }
      const folder = title.trim()
      const id = slugify(folder)
      if (!id) { json(res, 400, { error: 'Tên không hợp lệ.' }); return }
      if (folderFor(id)) { json(res, 409, { error: 'Đã có bộ ảnh trùng tên.' }); return }

      await fsp.mkdir(path.join(ORIGINALS, folder), { recursive: true })
      const catalogue = readCatalogue()
      catalogue.sets[id] = { title: title.trim().toUpperCase(), subtitle, description, year, location }
      catalogue.order = [...(catalogue.order ?? []), id]
      writeCatalogue(catalogue)
      json(res, 200, { id, folder })
      return
    }

    if (route === '/api/meta' && req.method === 'POST') {
      const { id, meta } = JSON.parse(await body(req))
      const catalogue = readCatalogue()
      if (!catalogue.sets[id]) catalogue.sets[id] = {}
      Object.assign(catalogue.sets[id], meta)
      writeCatalogue(catalogue)
      json(res, 200, { ok: true })
      return
    }

    if (route === '/api/order' && req.method === 'POST') {
      const { order } = JSON.parse(await body(req))
      const catalogue = readCatalogue()
      catalogue.order = order
      writeCatalogue(catalogue)
      json(res, 200, { ok: true })
      return
    }

    if (route === '/api/upload' && req.method === 'POST') {
      const id = url.searchParams.get('set')
      const name = path.basename(url.searchParams.get('name') ?? '')
      const target = folderFor(id)
      if (!target) { json(res, 404, { error: 'Không tìm thấy bộ ảnh.' }); return }
      if (!IMAGE_RE.test(name)) { json(res, 400, { error: `Không nhận tệp ${name}` }); return }

      const buf = await body(req)
      // Prove it is an image before it lands in the archive.
      try { await sharp(buf).metadata() } catch { json(res, 400, { error: `${name} không phải ảnh đọc được.` }); return }

      let dest = path.join(ORIGINALS, target.folder, name)
      let n = 1
      while (fs.existsSync(dest)) {
        const ext = path.extname(name)
        dest = path.join(ORIGINALS, target.folder, `${path.basename(name, ext)}-${n++}${ext}`)
      }
      await fsp.writeFile(dest, buf)
      json(res, 200, { saved: path.basename(dest) })
      return
    }

    /**
     * The Mac app hands over file paths rather than bytes: both ends are on
     * this machine, so copying a 40mb original through HTTP would be work for
     * its own sake.
     */
    if (route === '/api/import-paths' && req.method === 'POST') {
      const { id, paths } = JSON.parse(await body(req))
      const target = folderFor(id)
      if (!target) { json(res, 404, { error: 'Không tìm thấy bộ ảnh.' }); return }

      const added = []
      const failed = []
      for (const src of paths ?? []) {
        const name = path.basename(src)
        if (!IMAGE_RE.test(name)) { failed.push(`${name}: không phải ảnh`); continue }
        try {
          await sharp(src).metadata()
          let dest = path.join(ORIGINALS, target.folder, name)
          let n = 1
          while (fs.existsSync(dest)) {
            const ext = path.extname(name)
            dest = path.join(ORIGINALS, target.folder, `${path.basename(name, ext)}-${n++}${ext}`)
          }
          await fsp.copyFile(src, dest)
          added.push(path.basename(dest))
        } catch (err) {
          failed.push(`${name}: ${err.message.split('\n')[0]}`)
        }
      }
      json(res, 200, { added, failed })
      return
    }

    if (route === '/api/delete-file' && req.method === 'POST') {
      const { id, file } = JSON.parse(await body(req))
      const target = folderFor(id)
      if (!target) { json(res, 404, { error: 'Không tìm thấy bộ ảnh.' }); return }
      const victim = path.join(ORIGINALS, target.folder, path.basename(file))
      if (!fs.existsSync(victim)) { json(res, 404, { error: 'Không tìm thấy tệp.' }); return }
      // Moved aside rather than destroyed: this app should not be able to lose
      // someone's photograph.
      const bin = path.join(ORIGINALS, target.folder, '.đã bỏ')
      await fsp.mkdir(bin, { recursive: true })
      await fsp.rename(victim, path.join(bin, path.basename(file)))
      json(res, 200, { ok: true, movedTo: bin })
      return
    }

    if (route === '/api/images' && req.method === 'POST') {
      stream(res, [[process.execPath, ['scripts/import-images.mjs']]])
      return
    }

    if (route === '/api/deploy' && req.method === 'POST') {
      const { message } = JSON.parse(await body(req) || '{}')
      const note = (message || 'Cập nhật ảnh').replace(/["`$\\]/g, '')

      // `git push` on its own fails on a branch that has never been pushed —
      // and the first deploy is always such a branch. Naming the destination
      // works in both cases and sets the upstream on the way through.
      const head = await git('rev-parse', '--abbrev-ref', 'HEAD')
      const branch = head.code === 0 && head.out ? head.out : 'main'

      stream(res, [
        [process.execPath, ['scripts/import-images.mjs']],
        [process.execPath, ['node_modules/vite/bin/vite.js', 'build']],
        ['git', ['add', '-A']],
        ['git', ['commit', '-m', note, '--allow-empty']],
        ['git', ['push', '-u', 'origin', branch]],
      ])
      return
    }

    if (route === '/api/domain' && req.method === 'POST') {
      const { domain } = JSON.parse(await body(req))
      const file = path.join(root, 'public/CNAME')
      const clean = (domain ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      if (!clean) {
        // No domain: the workflow falls back to the github.io path on its own.
        await fsp.rm(file, { force: true })
        json(res, 200, { domain: null })
        return
      }
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean)) { json(res, 400, { error: 'Tên miền không hợp lệ.' }); return }
      await fsp.writeFile(file, clean + '\n')
      json(res, 200, { domain: clean })
      return
    }

    if (route === '/api/git-init' && req.method === 'POST') {
      const { remote } = JSON.parse(await body(req))
      const url = (remote ?? '').trim()

      if (!/^(https:\/\/github\.com\/|git@github\.com:)/.test(url)) {
        json(res, 400, { error: 'Địa chỉ phải bắt đầu bằng https://github.com/ hoặc git@github.com:' })
        return
      }
      // The instructions use placeholders; pasting one verbatim points the
      // repository at an address that does not exist, and the push fails with
      // a bare error code. Catching it here says why.
      if (/T[ÊE]N-B[ẠA]N|ten-ban|username|your-?name|USER/i.test(url)) {
        json(res, 400, { error: 'Địa chỉ còn chỗ giữ chỗ — thay bằng tên tài khoản GitHub thật của bạn.' })
        return
      }

      // `git remote add` fails with code 128 if origin already exists, which
      // it does the moment anyone has run git by hand. Set it instead.
      const existing = await git('remote', 'get-url', 'origin')
      const wire = existing.code === 0
        ? ['git', ['remote', 'set-url', 'origin', url]]
        : ['git', ['remote', 'add', 'origin', url]]

      stream(res, [
        ['git', ['init', '-b', 'main']],
        wire,
        ['git', ['add', '-A']],
        ['git', ['commit', '-m', 'Maison Le Paria', '--allow-empty']],
        ['git', ['push', '-u', 'origin', 'main']],
      ])
      return
    }

    if (route === '/api/git-remote' && req.method === 'POST') {
      const { remote } = JSON.parse(await body(req))
      const url = (remote ?? '').trim()
      if (!/^(https:\/\/github\.com\/|git@github\.com:)/.test(url)) {
        json(res, 400, { error: 'Địa chỉ phải bắt đầu bằng https://github.com/ hoặc git@github.com:' })
        return
      }
      if (/T[ÊE]N-B[ẠA]N|ten-ban|username|your-?name|USER/i.test(url)) {
        json(res, 400, { error: 'Địa chỉ còn chỗ giữ chỗ — thay bằng tên tài khoản GitHub thật của bạn.' })
        return
      }
      const existing = await git('remote', 'get-url', 'origin')
      const out = existing.code === 0
        ? await git('remote', 'set-url', 'origin', url)
        : await git('remote', 'add', 'origin', url)
      if (out.code !== 0) { json(res, 500, { error: out.out }); return }
      json(res, 200, { remote: url })
      return
    }

    res.writeHead(404).end('không có')
  } catch (err) {
    json(res, 500, { error: err.message })
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ! Cổng ${PORT} đang bận — có một Studio khác đang chạy.`)
    console.error(`    Đóng bản đó rồi mở lại, hoặc chạy với cổng khác: STUDIO_PORT=5200\n`)
    process.exit(2)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`\n  Studio — Maison Le Paria`)
  console.log(`  http://localhost:${PORT}\n`)
  console.log(`  Kho ảnh gốc: ${ORIGINALS}\n`)
})
