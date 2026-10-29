import { describe, expect, it } from 'vitest'
import { DEFAULT_BRANDING, LIMITS, brandingSchema, brandingStyle, checkImage, parseStoredBranding, sniffImage } from '@/lib/branding'

const valid = {
  ...DEFAULT_BRANDING,
  siteUrl: 'https://acme.example/',
  colors: { ...DEFAULT_BRANDING.colors, accent: '#FD0' },
  typography: { ...DEFAULT_BRANDING.typography, displayWeight: '700', baseSize: '18', headingScale: '1.234' },
}

function bytes(...values: number[]) {
  return new Uint8Array(values)
}

describe('brandingSchema', () => {
  it('accepts the defaults', () => {
    expect(brandingSchema.parse(DEFAULT_BRANDING)).toEqual(DEFAULT_BRANDING)
  })

  it('normalises form input', () => {
    const parsed = brandingSchema.parse(valid)
    expect(parsed.siteUrl).toBe('https://acme.example')
    expect(parsed.colors.accent).toBe('#ffdd00')
    expect(parsed.typography).toEqual({ ...DEFAULT_BRANDING.typography, displayWeight: 700, baseSize: 18, headingScale: 1.23 })
    expect(brandingSchema.parse({ ...valid, siteUrl: '' }).siteUrl).toBeUndefined()
    expect(brandingSchema.parse({ ...valid, siteUrl: '/start' }).siteUrl).toBe('/start')
  })

  it.each([
    ['empty name', { name: ' ' }],
    ['javascript: website', { siteUrl: 'javascript:alert(1)' }],
    ['protocol-relative website', { siteUrl: '//evil.example' }],
    ['CSS in a colour', { colors: { ...DEFAULT_BRANDING.colors, ink: 'red; background: url(x)' } }],
    ['unknown font', { typography: { ...DEFAULT_BRANDING.typography, bodyFont: 'Comic Sans' } }],
    ['odd weight', { typography: { ...DEFAULT_BRANDING.typography, displayWeight: 750 } }],
    ['tiny base size', { typography: { ...DEFAULT_BRANDING.typography, baseSize: LIMITS.baseSize.min - 1 } }],
    ['huge headings', { typography: { ...DEFAULT_BRANDING.typography, headingScale: 3 } }],
  ])('rejects %s', (_name, patch) => {
    expect(brandingSchema.safeParse({ ...DEFAULT_BRANDING, ...patch }).success).toBe(false)
  })
})

describe('parseStoredBranding', () => {
  it('fills missing fields from the defaults', () => {
    expect(parseStoredBranding(undefined)).toEqual(DEFAULT_BRANDING)
    expect(parseStoredBranding({ name: 'Acme', colors: { accent: '#000000' } })).toEqual({
      ...DEFAULT_BRANDING,
      name: 'Acme',
      colors: { ...DEFAULT_BRANDING.colors, accent: '#000000' },
    })
  })

  it('falls back to the defaults for invalid rows', () => {
    expect(parseStoredBranding({ colors: { accent: 'nope' } })).toEqual(DEFAULT_BRANDING)
  })
})

describe('images', () => {
  it('detects types from the content', () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImage(bytes(0, 0, 1, 0, 1, 0))).toBe('image/x-icon')
    expect(sniffImage(new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml')
    expect(sniffImage(new TextEncoder().encode('<html><svg></svg></html>'))).toBeNull()
    expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBeNull()
  })

  it('rejects oversized and unknown files', () => {
    const big = new Uint8Array(LIMITS.assetBytes + 1)
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(checkImage(big)).toEqual({ ok: false, reason: 'tooLarge' })
    expect(checkImage(bytes(1, 2, 3))).toEqual({ ok: false, reason: 'unsupported' })
  })
})

describe('brandingStyle', () => {
  it('maps settings to tokens', () => {
    const style = brandingStyle({ ...DEFAULT_BRANDING, typography: { ...DEFAULT_BRANDING.typography, displayFont: 'system-serif' } })
    expect(style['--rf-accent']).toBe(DEFAULT_BRANDING.colors.accent)
    expect(style['--rf-font-display']).toContain('Georgia')
    expect(style['--rf-font-body']).toBe('var(--rf-ff-space-grotesk)')
    expect(style['--rf-display-axes']).toBe('normal')
  })
})
