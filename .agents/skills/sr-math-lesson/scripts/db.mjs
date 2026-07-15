// sr-math-lesson — shared server-only Postgres access for the saver scripts.
// Resolves the repo root via git, reads the git-ignored root .env for
// EASYAPP_DATABASE_URL, and returns a postgres client bound to the project
// schema. Never echoes the secret. One implementation so ledger/content savers
// do not each re-parse .env (SSOT for DB access in this skill).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

export function repoRoot() {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim() }
  catch { throw new Error('not inside a git repo') }
}

export function readEnv(root = repoRoot()) {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) throw new Error('.env not found at repo root')
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

export function connect() {
  const env = readEnv()
  if (!env.EASYAPP_DATABASE_URL) throw new Error('no EASYAPP_DATABASE_URL in .env')
  return postgres(env.EASYAPP_DATABASE_URL, { ssl: 'require', max: 3, connection: { search_path: '"stemrobin-schema"' } })
}
