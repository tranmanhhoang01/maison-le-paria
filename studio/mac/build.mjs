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

const icon = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0b0c0d"/>
  <text x="50%" y="50%" dy="${size * 0.115}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${size * 0.46}"
        fill="#e9e5de">M</text>
  <rect x="${size * 0.30}" y="${size * 0.70}" width="${size * 0.40}" height="${size * 0.014}"
        fill="#c9bda8"/>
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
