import { afterEach, describe, expect, it, vi } from 'vitest'
import { site } from '@/lib/site'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('site', () => {
  it('works without any variables', () => {
    expect(site()).toEqual({
      imprintUrl: undefined,
      privacyUrl: undefined,
      timeZone: 'UTC',
      adminLanguage: 'en',
    })
  })

  it('reads links, time zone and admin language', () => {
    vi.stubEnv('REFORM_IMPRINT_URL', '/imprint')
    vi.stubEnv('REFORM_PRIVACY_URL', 'https://acme.example/privacy/')
    vi.stubEnv('REFORM_TIMEZONE', 'Europe/Berlin')
    vi.stubEnv('REFORM_ADMIN_LANGUAGE', 'de')
    expect(site()).toEqual({
      imprintUrl: '/imprint',
      privacyUrl: 'https://acme.example/privacy',
      timeZone: 'Europe/Berlin',
      adminLanguage: 'de',
    })
  })

  it('rejects invalid values', () => {
    vi.stubEnv('REFORM_PRIVACY_URL', 'javascript:alert(1)')
    expect(() => site()).toThrow(/REFORM_PRIVACY_URL/)
    vi.unstubAllEnvs()
    vi.stubEnv('REFORM_IMPRINT_URL', '//evil.example/imprint')
    expect(() => site()).toThrow(/REFORM_IMPRINT_URL/)
    vi.unstubAllEnvs()
    vi.stubEnv('REFORM_TIMEZONE', 'Mars/Olympus')
    expect(() => site()).toThrow(/REFORM_TIMEZONE/)
    vi.unstubAllEnvs()
    vi.stubEnv('REFORM_ADMIN_LANGUAGE', 'fr')
    expect(() => site()).toThrow(/REFORM_ADMIN_LANGUAGE/)
  })
})
