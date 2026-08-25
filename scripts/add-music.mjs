#!/usr/bin/env node
/**
 * Puts a piece of music behind the site.
 *
 *   npm run music ~/Music/ban-nhac.wav
 *   npm run music --off
 *
 * Whatever you hand it — wav, mp3, m4a, aiff, flac — comes out as a web-ready
 * AAC file of a sensible size, and content/sound.json is updated to point at
 * it. Nothing else in the project needs touching.
 *
 * The file has to be one you have the right to publish. A photography site
 * with its own domain is a public broadcast, and a commercial track needs a
 * licence there even if you own a copy of it.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configPath = path.join(root, 'content/sound.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const outDir = path.join(root, 'public/audio')
const out = path.join(outDir, 'nhac.m4a')

const save = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')

const input = process.argv[2]

if (!input || input === '--help') {
  console.log(`\n  npm run music <đường-dẫn-tệp-nhạc>   thêm hoặc thay nhạc nền`)
  console.log(`  npm run music --off                  tắt nhạc nền\n`)
  process.exit(input ? 0 : 1)
}

if (input === '--off') {
  config.music.file = ''
  config.music.credit = ''
  save()
  fs.rmSync(out, { force: true })
  console.log('\n  ✓ Đã tắt nhạc nền. Website quay lại chỉ có tiếng phòng.\n')
  process.exit(0)
}

const source = path.resolve(input.replace(/^~/, process.env.HOME ?? '~'))
if (!fs.existsSync(source)) {
  console.error(`\n  ! Không tìm thấy tệp: ${source}\n`)
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })
fs.rmSync(out, { force: true })

// afconvert is fussy about bitrate on some source formats, so try the good
// settings first and fall back rather than failing outright.
const attempts = [
  ['-f', 'm4af', '-d', 'aac', '-b', '128000', '-s', '3'],
  ['-f', 'm4af', '-d', 'aac', '-b', '96000'],
  ['-f', 'm4af', '-d', 'aac'],
]

let done = false
for (const opts of attempts) {
  try {
    execFileSync('afconvert', [...opts, source, out], { stdio: 'ignore' })
    if (fs.existsSync(out) && fs.statSync(out).size > 0) { done = true; break }
  } catch { /* try the next one */ }
}

if (!done) {
  console.error(`\n  ! Không chuyển đổi được tệp này.`)
  console.error(`    Thử xuất sang .wav hoặc .m4a rồi chạy lại.\n`)
  process.exit(1)
}

config.music.file = 'audio/nhac.m4a'
save()

const info = execFileSync('afinfo', [out]).toString()
const seconds = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 0)
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1)
const mins = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

console.log(`\n  ✓ public/audio/nhac.m4a  —  ${mins}, ${mb} mb`)
if (Number(mb) > 6) {
  console.log(`\n  ! Hơi nặng cho một trang web. Cân nhắc cắt ngắn hoặc giảm chất lượng.`)
}
console.log(`\n  Nhớ ghi nguồn nhạc vào "credit" trong content/sound.json nếu giấy phép yêu cầu.\n`)
