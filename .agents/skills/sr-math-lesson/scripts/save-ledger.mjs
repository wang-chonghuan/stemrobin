#!/usr/bin/env node
// sr-math-lesson cap1 (JSONB-first) — deterministic ledger persistence into
// sr_content_ledger. The per-stage concept ledger becomes the DB SSOT (G7): the
// content/exercise authoring reads it back from the DB, never from a local file.
// Validates the ledger with the shared closure core, then upserts on PK
// (subject, stage), advancing src_rev on change.
//
// Usage (from repo root):
//   node .agents/skills/sr-math-lesson/scripts/save-ledger.mjs --ledger <scratch/stage.json>
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateLedger } from './ledger-core.mjs'
import { connect } from './db.mjs'

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1) }

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++ } }
if (!args.ledger) fail('missing --ledger <path to ledger json>')

const p = resolve(process.cwd(), args.ledger)
if (!existsSync(p)) fail(`ledger file not found: ${args.ledger}`)
let ledger
try { ledger = JSON.parse(readFileSync(p, 'utf8')) } catch (e) { fail(`ledger JSON parse error: ${e.message}`) }

const { problems, ownedBy } = validateLedger(ledger)
if (problems.length) fail(`ledger validation failed:\n  - ${problems.join('\n  - ')}`)

const sql = await connect()
try {
  const prior = await sql`select ledger, src_rev from sr_content_ledger where subject = ${ledger.subject} and stage = ${ledger.stage}`
  const changed = !prior.length || JSON.stringify(prior[0].ledger) !== JSON.stringify(ledger)
  const nextRev = prior.length ? Number(prior[0].src_rev) + (changed ? 1 : 0) : 1
  await sql`
    insert into sr_content_ledger (subject, stage, ledger, src_rev, updated_at)
    values (${ledger.subject}, ${ledger.stage}, ${sql.json(ledger)}, ${nextRev}, now())
    on conflict (subject, stage) do update set
      ledger = excluded.ledger, src_rev = excluded.src_rev, updated_at = now()
  `
  console.log(`✓ sr_content_ledger upserted: ${ledger.subject} stage ${ledger.stage} · ${ledger.lessons.length} lessons · ${ownedBy.size} terms · src_rev=${nextRev}${changed ? '' : ' (unchanged)'}`)
} finally {
  await sql.end()
}
