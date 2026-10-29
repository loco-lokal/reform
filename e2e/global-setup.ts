import { Client } from 'pg'
import { E2E_ENV } from './env'

// Creates the e2e database if needed, migrates it and starts every run from empty tables.
export default async function globalSetup() {
  const url = new URL(E2E_ENV.REFORM_DATABASE_URL)
  const name = url.pathname.slice(1)
  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString() })
  await admin.connect()
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (!rowCount) await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`)
  } finally {
    await admin.end()
  }

  Object.assign(process.env, E2E_ENV)
  const { migrate } = await import('../lib/migrate')
  const { pool } = await import('../lib/db')
  await migrate()
  await pool().query('TRUNCATE forms, branding, branding_assets CASCADE')
  await pool().end()
}
