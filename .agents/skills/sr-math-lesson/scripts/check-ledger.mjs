#!/usr/bin/env node
// sr-math-lesson — deterministic ledger validation CLI (thin wrapper over
// ledger-core.mjs, the shared closure SSOT). Validates schema, uniqueness, and
// the prerequisite-closure rule (every consumed term must be introduced earlier
// or assumed). Optional --vocab <lesson.html> --id <lesson-id>: greps the HTML
// for terms owned by LATER lessons (a mechanical slice of the vocabulary contract).
//
// Usage:
//   node check-ledger.mjs resources/content/math-ledger/stage-2.json
//   node check-ledger.mjs resources/content/math-ledger/stage-2.json --vocab <lesson.html> --id math-s2-05
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateLedger } from './ledger-core.mjs'

function fail(msgs) {
  console.error('✗ ledger check failed:')
  for (const m of msgs) console.error(`  - ${m}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const jsonPath = args[0]
if (!jsonPath) { console.error('usage: check-ledger.mjs <ledger.json> [--vocab <html> --id <lesson-id>]'); process.exit(2) }
const opt = {}
for (let i = 1; i < args.length; i++) if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1]; i++ }

const p = resolve(process.cwd(), jsonPath)
if (!existsSync(p)) fail([`not found: ${jsonPath}`])
let ledger
try { ledger = JSON.parse(readFileSync(p, 'utf8')) } catch (e) { fail([`JSON parse error: ${e.message}`]) }

const { problems, ownedBy } = validateLedger(ledger)

// --- optional vocab slice: later-lesson terms must not appear in this lesson's HTML ---
if (opt.vocab) {
  if (!opt.id) fail(['--vocab requires --id <lesson-id>'])
  const hp = resolve(process.cwd(), opt.vocab)
  if (!existsSync(hp)) fail([`vocab html not found: ${opt.vocab}`])
  const html = readFileSync(hp, 'utf8')
  // The header necessarily names the stage theme, which may mention a later
  // concept (for example "方程和不等式"). Check learner-facing lesson body only.
  const lessonBody = html.replace(/<header class="sr-l-head">[\s\S]*?<\/header>/, '')
  const idx = ledger.lessons.findIndex((l) => l.id === opt.id)
  if (idx === -1) fail([`--id ${opt.id} not in ledger`])
  for (const later of ledger.lessons.slice(idx + 1)) {
    for (const intro of later.introduces || []) {
      // A one-character term such as "元" is too ambiguous for raw Chinese
      // substring matching ("6 元" is money, not the equation concept).
      const appears = intro.term?.length === 1
        ? lessonBody.includes(`<span class="sr-term">${intro.term}</span>`)
        : lessonBody.includes(intro.term)
      if (appears)
        problems.push(`vocab: "${intro.term}" belongs to LATER lesson ${later.id} but appears in ${opt.id}'s html`)
    }
  }
}

if (problems.length) fail(problems)
console.log(`✓ ledger ok: stage ${ledger.stage} · ${ledger.lessons.length} lessons · ${ownedBy.size} terms owned · closure holds${opt.vocab ? ' · vocab slice clean' : ''}`)
