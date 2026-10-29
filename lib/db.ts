import { Pool } from 'pg'
import { config } from './config'

// One pool per process; kept on globalThis so dev hot reloads do not leak connections.
const globalForPool = globalThis as unknown as { reformPool?: Pool }

export function pool(): Pool {
  globalForPool.reformPool ??= new Pool({ connectionString: config().databaseUrl, max: 5 })
  return globalForPool.reformPool
}
