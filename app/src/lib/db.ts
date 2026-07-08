import postgres from 'postgres'

// Server-only Postgres client for the Azure easy-app shared database. The
// connection string (EASYAPP_DATABASE_URL) is a server secret and must never
// reach the browser bundle — this module is imported only from server functions.
// All tables live in the per-project schema `stemrobin-schema`.
let _sql: ReturnType<typeof postgres> | null = null

export function sql(): ReturnType<typeof postgres> {
  if (_sql) return _sql
  // Local authoring/dev uses EASYAPP_DATABASE_URL (.env); the deployed Container App
  // injects DATABASE_URL (n-easyapp). Accept either.
  const url = process.env.EASYAPP_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Missing EASYAPP_DATABASE_URL / DATABASE_URL')
  _sql = postgres(url, {
    ssl: 'require',
    max: 5,
    // Recycle idle/old connections so we never issue a query on a socket that
    // Azure Postgres already closed after the app sat idle (which otherwise made
    // the first request after a pause fail).
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 15,
    // Quoted because the schema name contains a hyphen.
    connection: { search_path: '"stemrobin-schema"' },
  })
  return _sql
}
