// Service configuration from environment variables, read lazily so `next build` needs none of them.

export type Config = {
  databaseUrl: string
  apiSecret: string
  adminPassword: string
  sessionSecret: string
  publicUrl: string
  submitRateLimitPerHour: number
}

let cached: Config | undefined

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export function config(): Config {
  if (cached) return cached
  const sessionSecret = required('REFORM_SESSION_SECRET')
  if (sessionSecret.length < 32) throw new Error('REFORM_SESSION_SECRET must be at least 32 characters')
  const rate = Number(process.env.REFORM_SUBMIT_RATE_LIMIT_PER_HOUR || 30)
  if (!Number.isInteger(rate) || rate < 1) throw new Error('REFORM_SUBMIT_RATE_LIMIT_PER_HOUR must be a positive integer')
  cached = {
    databaseUrl: required('REFORM_DATABASE_URL'),
    apiSecret: required('REFORM_API_SECRET'),
    adminPassword: required('REFORM_ADMIN_PASSWORD'),
    sessionSecret,
    publicUrl: required('REFORM_PUBLIC_URL').replace(/\/+$/, ''),
    submitRateLimitPerHour: rate,
  }
  return cached
}
