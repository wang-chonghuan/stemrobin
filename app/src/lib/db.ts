import postgres from 'postgres'

// Server-only Postgres client. The connection string is a server secret and must
// never reach the browser bundle — this module is imported only from server
// functions. All tables live in the per-project schema `lemmadeck-schema`.
//
// The content DB moved off the Azure easy-app instance (it was intermittently
// refusing connections) onto the shared Supabase project, schema
// `lemmadeck-schema`. LEMMADECK_DATABASE_URL wins when set; the older vars stay
// as a fallback so an unmigrated deploy keeps working.
let _sql: ReturnType<typeof postgres> | null = null

export function sql(): ReturnType<typeof postgres> {
  if (_sql) return _sql
  const url =
    process.env.LEMMADECK_DATABASE_URL ||
    process.env.EASYAPP_DATABASE_URL ||
    process.env.DATABASE_URL
  if (!url) throw new Error('Missing LEMMADECK_DATABASE_URL / EASYAPP_DATABASE_URL / DATABASE_URL')
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
    connection: { search_path: '"lemmadeck-schema"' },
  })
  return _sql
}
