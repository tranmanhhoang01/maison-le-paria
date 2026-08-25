import config from '../../content/sound.json'

/**
 * The sound of the room: an ambient layer, and music if a track has been
 * added.
 *
 * ONE THING TO KNOW: no browser will play audio before the visitor has
 * touched the page. Chrome and Safari both refuse, and there is no way around
 * it — a site that could make noise on arrival would be a site that makes
 * noise on arrival. So this starts at the first click or tap, which on this
 * site is a second or two after landing.
 *
 * Everything is configured in content/sound.json.
 */

const PREF = 'mlp:sound'
const base = import.meta.env.BASE_URL

let ctx = null
let master = null
let sources = []
let music = null
let musicFade = null

export const soundAllowed = () => {
  try { return localStorage.getItem(PREF) !== 'off' } catch { return true }
}

export const rememberSound = (on) => {
  try { localStorage.setItem(PREF, on ? 'on' : 'off') } catch {}
}

export const musicCredit = () => (config.music?.file ? config.music.credit || '' : '')

/* ── The room ────────────────────────────────────────────────────────── */

/** Brown-ish noise: heavy on the low end, the way a large empty room is. */
function noiseBuffer(context, seconds = 4) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.2
  }
  return buffer
}

function buildRoom() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return false
  ctx = new AudioCtx()

  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  if (config.ambience?.enabled === false) return true

  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx)
  noise.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 340
  filter.Q.value = 0.6

  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.025      // one breath every forty seconds
  lfoGain.gain.value = 120
  lfo.connect(lfoGain).connect(filter.frequency)

  const hum = ctx.createOscillator()
  const humGain = ctx.createGain()
  hum.type = 'sine'
  hum.frequency.value = 57
  humGain.gain.value = 0.012

  noise.connect(filter).connect(master)
  hum.connect(humGain).connect(master)
  noise.start(); lfo.start(); hum.start()
  sources = [noise, lfo, hum]
  return true
}

/* ── Music ───────────────────────────────────────────────────────────── */

/**
 * Played as a plain audio element rather than through the graph: a track may
 * run for minutes, and an element streams it instead of decoding the whole
 * thing into memory first.
 */
function startMusic() {
  const file = config.music?.file
  if (!file || music) return

  music = new Audio(base + file)
  music.loop = config.music.loop !== false
  music.volume = 0
  music.play()
    .then(() => fadeMusic(config.music.volume ?? 0.3, config.music.fadeIn ?? 5))
    .catch(() => { music = null })
}

/** Audio elements have no ramp of their own, so this walks the volume. */
function fadeMusic(target, seconds) {
  if (!music) return
  clearInterval(musicFade)
  const step = 1 / 30
  const from = music.volume
  const total = Math.max(seconds, 0.01)
  let t = 0
  musicFade = setInterval(() => {
    t += step
    if (!music) { clearInterval(musicFade); return }
    const k = Math.min(t / total, 1)
    music.volume = Math.max(0, Math.min(1, from + (target - from) * k))
    if (k >= 1) clearInterval(musicFade)
  }, step * 1000)
}

/* ── Switch ──────────────────────────────────────────────────────────── */

export async function startSound() {
  if (!ctx && !buildRoom()) return false
  try { await ctx.resume() } catch { return false }

  // Not every event counts as permission. Escape, a modifier key, a
  // programmatic call — the context stays suspended and reports it. Saying so
  // honestly is what lets the caller keep waiting for a gesture that works.
  if (ctx.state !== 'running') return false

  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.linearRampToValueAtTime(config.ambience?.volume ?? 0.09, ctx.currentTime + 2.5)
  startMusic()
  return true
}

export function stopSound() {
  if (music) {
    fadeMusic(0, 1.2)
    setTimeout(() => { music?.pause(); music = null }, 1400)
  }
  if (!ctx || !master) return
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2)
  setTimeout(() => {
    sources.forEach((s) => { try { s.stop() } catch {} })
    sources = []
    ctx?.close()
    ctx = null; master = null
  }, 1400)
}
