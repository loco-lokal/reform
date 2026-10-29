// Display settings from optional environment variables. Unlike config(), nothing here is required, so pages
// and the Markdown export work with the defaults. Name, website, logo, colours and fonts are edited in the
// admin instead (lib/branding.ts).

import { parseSiteUrl } from './branding'
import { LANGUAGES, type Language } from './forms'

export type Site = {
  imprintUrl?: string
  privacyUrl?: string
  /** IANA time zone for dates in pages and exports. */
  timeZone: string
  /** Language of the admin area. */
  adminLanguage: Language
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

function url(name: string): string | undefined {
  const value = optional(name)
  if (!value) return undefined
  const parsed = parseSiteUrl(value)
  if (parsed) return parsed
  throw new Error(`${name} must be an http(s) URL or an absolute path`)
}

function timeZone(): string {
  const value = optional('REFORM_TIMEZONE') ?? 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
  } catch {
    throw new Error(`REFORM_TIMEZONE "${value}" is not a valid IANA time zone`)
  }
  return value
}

function adminLanguage(): Language {
  const value = optional('REFORM_ADMIN_LANGUAGE') ?? 'en'
  if (!(LANGUAGES as readonly string[]).includes(value)) throw new Error(`REFORM_ADMIN_LANGUAGE must be one of ${LANGUAGES.join(', ')}`)
  return value as Language
}

export function site(): Site {
  return {
    imprintUrl: url('REFORM_IMPRINT_URL'),
    privacyUrl: url('REFORM_PRIVACY_URL'),
    timeZone: timeZone(),
    adminLanguage: adminLanguage(),
  }
}
