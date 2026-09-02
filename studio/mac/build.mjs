#!/usr/bin/env node
/**
 * Builds "Maison Le Paria Studio.app" — a real Mac application wrapping the
 * local studio server, compiled with the Swift already on this machine.
 *
 * No Electron, no bundler, no dependency: the whole app is one Swift file and
 * weighs about a megabyte.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = Number(process.env.STUDIO_PORT ?? 5199)
const APP = process.env.APP_DEST
  ? path.resolve(process.env.APP_DEST)
  : path.join(root, 'Maison Le Paria Studio.app')

const contents = path.join(APP, 'Contents')
const macos = path.join(contents, 'MacOS')
const resources = path.join(contents, 'Resources')

fs.rmSync(APP, { recursive: true, force: true })
fs.mkdirSync(macos, { recursive: true })
fs.mkdirSync(resources, { recursive: true })

/* ── The icon ────────────────────────────────────────────────────────── */

/**
 * Biểu tượng: tờ giấy dó với con triện đỏ đóng lên — cùng dấu hiệu với
 * website. Bốn ô hoa văn hồi văn xoay bốn hướng, giống Seal.jsx.
 */
const KEY = 'M4 28V6h20M24 10v14H10M10 20v-6h8'
const CORNERS = [
  'translate(14 14)',
  'translate(86 14) scale(-1 1)',
  'translate(14 86) scale(1 -1)',
  'translate(86 86) scale(-1 -1)',
]
const icon = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#e5d9c0"/>
  <g transform="translate(50 50) rotate(-4) translate(-31 -31) scale(0.62)">
    <rect width="100" height="100" rx="3" fill="#9b2c1c"/>
    <g fill="none" stroke="#f8f2e7" stroke-linecap="butt">
      <rect x="6" y="6" width="88" height="88" rx="1" stroke-width="1.8"/>
      <rect x="10" y="10" width="80" height="80" rx="0.5" stroke-width="0.9" opacity="0.8"/>
      ${CORNERS.map((t) => `<path d="${KEY}" transform="${t}" stroke-width="2.3"/>`).join('')}
    </g>
  </g>
</svg>`)

const iconset = path.join(root, 'studio/mac/Studio.iconset')
fs.rmSync(iconset, { recursive: true, force: true })
fs.mkdirSync(iconset, { recursive: true })

for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const px = size * scale
    const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`
    await sharp(icon(px), { density: 300 }).resize(px, px).png().toFile(path.join(iconset, name))
  }
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'Studio.icns')])
fs.rmSync(iconset, { recursive: true, force: true })

/* ── Info.plist ──────────────────────────────────────────────────────── */

fs.writeFileSync(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Studio</string>
  <key>CFBundleDisplayName</key><string>Maison Le Paria Studio</string>
  <key>CFBundleIdentifier</key><string>com.maisonleparia.studio</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Studio</string>
  <key>CFBundleIconFile</key><string>Studio</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
`)

/* ── Compile ─────────────────────────────────────────────────────────── */

const source = fs.readFileSync(path.join(root, 'studio/mac/Studio.swift'), 'utf8')
  .replace('PROJECT_ROOT', JSON.stringify(root))
  .replace('STUDIO_PORT', String(PORT))

const tmp = path.join(root, 'studio/mac/.Studio.generated.swift')
fs.writeFileSync(tmp, source)

try {
  // Without an explicit target, swiftc builds for the SDK it ships with —
  // which can be a macOS newer than the one running, and the app then refuses
  // to launch with a bare "incompatible version" error.
  execFileSync('swiftc', [
    '-swift-version', '5',
    '-target', 'arm64-apple-macos13.0',
    '-O',
    '-o', path.join(macos, 'Studio'),
    tmp,
  ], { stdio: 'inherit' })
} finally {
  fs.rmSync(tmp, { force: true })
}

// Unsigned apps are quarantined when they travel; this one never leaves the
// machine that built it, so an ad-hoc signature is enough to launch cleanly.
try {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP], { stdio: 'ignore' })
} catch { /* not fatal */ }

const size = execFileSync('du', ['-sh', APP]).toString().split('\t')[0]
console.log(`\n  ✓ ${path.basename(APP)}  (${size})`)
console.log(`    ${APP}`)
console.log(`\n  Mở bằng: open "${APP}"`)
console.log(`  Muốn có trong Launchpad: kéo app vào thư mục Applications.\n`)
