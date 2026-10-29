import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pool } from './db'

const LOCK_ID = 7343920113

// Applies lib/migrations/*.sql in file name order, once each, under an advisory lock
// so overlapping starts (e.g. during a rolling update) do not race.
export async function migrate(): Promise<void> {
  const dir = path.join(process.cwd(), 'lib', 'migrations')
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()
  const client = await pool().connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    for (const name of names) {
      const version = name.replace(/\.sql$/, '')
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version])
      if (rowCount) continue
      const sql = await readFile(path.join(dir, name), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${version}: ${(err as Error).message}`)
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    client.release()
  }
}
