import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const require = createRequire(path.join(repoRoot, 'app/package.json'))
const postgres = require('postgres')

function envValue(name) {
  const direct = process.env[name]
  if (direct) return direct
  const env = fs.readFileSync(path.join(repoRoot, '.env'), 'utf8')
  return env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
}

const url = envValue('LEMMADECK_DATABASE_URL')
if (!url) throw new Error('LEMMADECK_DATABASE_URL is required')

const schemaPath = path.join(
  repoRoot,
  'ssot-schemas/db-schemas/stemrobin.sql',
)
const schema = fs.readFileSync(schemaPath, 'utf8')
const begin = '-- BEGIN LEMMADECK TEXTBOOK MISTAKES'
const end = '-- END LEMMADECK TEXTBOOK MISTAKES'
const start = schema.indexOf(begin)
const finish = schema.indexOf(end)
if (start < 0 || finish < 0 || finish <= start) {
  throw new Error('LemmaDeck textbook-mistakes schema block is missing')
}
const block = schema.slice(start + begin.length, finish).trim()
if (!block.includes('"lemmadeck-schema".sr_textbook_mistakes')) {
  throw new Error('Schema block does not target the LemmaDeck schema')
}
if (block.includes('stemrobin-schema')) {
  throw new Error('Schema block must not target the retired Azure schema')
}

const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  connect_timeout: 15,
  connection: { search_path: '"lemmadeck-schema"' },
})

try {
  const before = await sql`
    select
      (select count(*)::int from sr_users) as users,
      (select count(*)::int from sr_lessons) as lessons,
      (select count(*)::int from sr_content_answer_events) as answer_events
  `
  await sql.begin(async (tx) => {
    await tx.unsafe(block)
  })
  await sql.begin(async (tx) => {
    await tx.unsafe(block)
  })

  const columns = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'lemmadeck-schema'
      and table_name = 'sr_textbook_mistakes'
    order by ordinal_position
  `
  const foreignKeys = await sql`
    select
      kcu.column_name,
      ccu.table_name as target_table,
      rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.constraint_schema = kcu.constraint_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
     and tc.constraint_schema = ccu.constraint_schema
    join information_schema.referential_constraints rc
      on tc.constraint_name = rc.constraint_name
     and tc.constraint_schema = rc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'lemmadeck-schema'
      and tc.table_name = 'sr_textbook_mistakes'
  `
  const indexes = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'lemmadeck-schema'
      and tablename = 'sr_textbook_mistakes'
  `
  const checks = await sql`
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'lemmadeck-schema'
      and table_name = 'sr_textbook_mistakes'
      and constraint_type = 'CHECK'
  `
  const after = await sql`
    select
      (select count(*)::int from sr_users) as users,
      (select count(*)::int from sr_lessons) as lessons,
      (select count(*)::int from sr_content_answer_events) as answer_events
  `

  const names = columns.map((row) => row.column_name)
  const required = [
    'id',
    'user_id',
    'book_id',
    'lesson_id',
    'exercise_number',
    'occurred_at',
  ]
  if (required.some((name) => !names.includes(name))) {
    throw new Error(`Unexpected mistake columns: ${names.join(', ')}`)
  }
  const userFk = foreignKeys.find((row) => row.column_name === 'user_id')
  if (!userFk || userFk.target_table !== 'sr_users' || userFk.delete_rule !== 'CASCADE') {
    throw new Error('Expected user_id -> sr_users ON DELETE CASCADE')
  }
  if (foreignKeys.some((row) => row.column_name === 'lesson_id')) {
    throw new Error('lesson_id must not have a foreign key')
  }
  if (!indexes.some((row) => row.indexname === 'sr_textbook_mistakes_user_time_idx')) {
    throw new Error('Mistake user/time index is missing')
  }
  if (
    !checks.some(
      (row) => row.constraint_name === 'sr_textbook_mistakes_identity_nonempty',
    )
  ) {
    throw new Error('Mistake non-empty identity check is missing')
  }
  if (JSON.stringify(before[0]) !== JSON.stringify(after[0])) {
    throw new Error('Additive schema apply changed existing row counts')
  }

  const fixture = await sql`
    select u.user_id, l.id as lesson_id
    from sr_users u
    cross join sr_lessons l
    order by u.user_id, l.id
    limit 1
  `
  if (!fixture.length) throw new Error('Schema rollback probe needs one user and lesson')
  const probeText = `STEMROBIN-114-rollback-${Date.now()}`
  let rejected = false
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into sr_content_answer_events
          (user_id, lesson_id, kind, node_id, is_correct, answer_text, locale)
        values (
          ${fixture[0].user_id}, ${fixture[0].lesson_id}, 'exercise',
          'STEMROBIN-114-rollback', false, ${probeText}, 'en'
        )
      `
      await tx`
        insert into sr_textbook_mistakes
          (user_id, book_id, lesson_id, exercise_number)
        values (${fixture[0].user_id}, '', ${fixture[0].lesson_id}, '1')
      `
    })
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error('Rollback probe did not reject the invalid mistake')
  const probeRows = await sql`
    select count(*)::int as count
    from sr_content_answer_events
    where answer_text = ${probeText}
  `
  if (probeRows[0].count !== 0) {
    throw new Error('Transaction failure left a partial answer event')
  }
  console.log('PASS schema: dedicated mistake table applied twice without data changes')
} finally {
  await sql.end()
}
