// Fixed environment for the e2e server and the tests. The database is truncated on every run, so it must
// be a throwaway one (default: reform_e2e on the local Postgres).

export const PORT = Number(process.env.REFORM_E2E_PORT || 3100)
export const BASE_URL = `http://localhost:${PORT}`

export const E2E_ENV = {
  REFORM_DATABASE_URL: process.env.REFORM_E2E_DATABASE_URL || 'postgres://reform:reform@localhost:5432/reform_e2e',
  REFORM_API_SECRET: 'e2e-api-key',
  REFORM_ADMIN_PASSWORD: 'e2e-admin-password',
  REFORM_SESSION_SECRET: 'e2e-session-secret-0123456789abcdef',
  REFORM_PUBLIC_URL: BASE_URL,
  REFORM_SUBMIT_RATE_LIMIT_PER_HOUR: '5',
  REFORM_TIMEZONE: 'UTC',
  REFORM_ADMIN_LANGUAGE: 'en',
  REFORM_IMPRINT_URL: 'https://example.com/imprint',
  REFORM_PRIVACY_URL: 'https://example.com/privacy',
}
