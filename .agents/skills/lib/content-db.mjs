// The one place the content-generation skills learn where the content lives.
//
// Why this file exists (STEMROBIN-124): the connection code used to be copied verbatim
// into six call sites across sr-voa1500 and sr-story — each reading `.env` by hand, each
// picking its own URL variable, each passing its own `search_path` string. When the app's
// content DB moved to the shared Supabase project (`lemmadeck-schema`), `app/src/lib/db.ts`
// followed and the six copies did not. The old database still connects and still accepts
// writes, so seven finished lessons were saved, reported success, and were invisible in the
// product. One definition, imported everywhere, is the fix — not six corrected copies.
//
// Keep the resolution order identical to `app/src/lib/db.ts`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { repoRoot } from '../sr-voa1500/scripts/vocab.mjs'

// The live content schema. The retired pair (EASYAPP_DATABASE_URL + "stemrobin-schema")
// is never written to again — see .dimleaper/charter/arch.md.
export const CONTENT_SCHEMA = 'lemmadeck-schema'

// The repo-root .env, parsed the way every one of these scripts parsed it.
export function readRepoEnv(root = repoRoot()) {
  const env = {}
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2]
    }
  } catch {
    // no .env — contentUrl() below raises the error that actually helps
  }
  return env
}

// Same order as app/src/lib/db.ts. The fallbacks exist so an unmigrated environment keeps
// reading; nothing new should ever be written through them.
export function contentUrl(env = readRepoEnv()) {
  const url =
    env.LEMMADECK_DATABASE_URL || env.EASYAPP_DATABASE_URL || env.DATABASE_URL
  if (!url)
    throw new Error(
      'no LEMMADECK_DATABASE_URL / EASYAPP_DATABASE_URL / DATABASE_URL in the repo-root .env',
    )
  return url
}

// A postgres client already scoped to the content schema. `max` is the only thing callers
// vary (a long save transaction wants more than a read-only report).
export function contentSql({ max = 2, env = readRepoEnv() } = {}) {
  return postgres(contentUrl(env), {
    ssl: 'require',
    max,
    idle_timeout: 20,
    // Quoted because the schema name contains a hyphen.
    connection: { search_path: `"${CONTENT_SCHEMA}"` },
  })
}
