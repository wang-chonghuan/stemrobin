#!/usr/bin/env node
// sr-voa1500 — 朗读生成 (STEMROBIN-78). Synthesizes one English sentence to
// mp3 bytes via the EXISTING Azure OpenAI `gpt-4o-mini-tts` deployment (no new
// cloud resource was created; config lives in the repo-root .env). Used by the
// short-text generation skill to pre-render per-sentence audio at save time, the
// same way math lessons pre-render their print PDF.
//
// Never echoes the key. Fails fast when config is missing (SSOT: no fallback that
// hides a missing source of truth).
//
// Usage (from repo root):
//   node .agents/skills/sr-voa1500/scripts/tts.mjs \
//     --text "Tom has a red bag." --out /tmp/s1.mp3
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(m) { console.error(`✗ ${m}`); process.exit(1) }

let repoRoot
try { repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim() }
catch { fail('not inside a git repo') }

const envPath = join(repoRoot, '.env')
if (!existsSync(envPath)) fail('.env not found at repo root')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}

const ENDPOINT = env.AZURE_TTS_ENDPOINT
const KEY = env.AZURE_TTS_KEY
const DEPLOYMENT = env.AZURE_TTS_DEPLOYMENT
const API_VERSION = env.AZURE_TTS_API_VERSION
const DEFAULT_VOICE = env.AZURE_TTS_VOICE
for (const [k, v] of Object.entries({ AZURE_TTS_ENDPOINT: ENDPOINT, AZURE_TTS_KEY: KEY, AZURE_TTS_DEPLOYMENT: DEPLOYMENT, AZURE_TTS_API_VERSION: API_VERSION, AZURE_TTS_VOICE: DEFAULT_VOICE }))
  if (!v) fail(`no ${k} in .env`)

// One sentence -> mp3 bytes. Throws with the API's own message on failure so a
// generation run surfaces the real cause instead of silently shipping no audio.
export async function synthesize(text, { voice = DEFAULT_VOICE } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('tts: empty text')
  const url = `${ENDPOINT.replace(/\/$/, '')}/openai/deployments/${DEPLOYMENT}/audio/speech?api-version=${API_VERSION}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: DEPLOYMENT, input: text, voice }),
  })
  if (!res.ok) throw new Error(`tts: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('tts: empty audio body')
  return buf
}

// CLI entry (only when run directly, so importing this module has no side effect).
if (process.argv[1] && process.argv[1].endsWith('tts.mjs')) {
  const args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
  if (!args.text || !args.out) fail('usage: tts.mjs --text "<sentence>" --out <file.mp3>')
  const bytes = await synthesize(args.text, args.voice ? { voice: args.voice } : {})
  writeFileSync(args.out, bytes)
  console.log(`✓ ${args.out} (${bytes.length} bytes)`)
}
