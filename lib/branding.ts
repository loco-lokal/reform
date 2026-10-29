// Branding edited in the admin: name, home website, colours, typography, logo and icon. Pure code with no
// server imports, so the admin form can share the font catalogue and defaults.

import { z } from 'zod'

/** Self-hosted fonts declared in app/layout.tsx (as CSS variables) plus system stacks. */
export const FONTS = {
  anybody: { label: 'Anybody', family: 'var(--rf-ff-anybody)' },
  'space-grotesk': { label: 'Space Grotesk', family: 'var(--rf-ff-space-grotesk)' },
  inter: { label: 'Inter', family: 'var(--rf-ff-inter)' },
  manrope: { label: 'Manrope', family: 'var(--rf-ff-manrope)' },
  'dm-sans': { label: 'DM Sans', family: 'var(--rf-ff-dm-sans)' },
  'bricolage-grotesque': { label: 'Bricolage Grotesque', family: 'var(--rf-ff-bricolage-grotesque)' },
  fraunces: { label: 'Fraunces', family: 'var(--rf-ff-fraunces)' },
  'playfair-display': { label: 'Playfair Display', family: 'var(--rf-ff-playfair-display)' },
  lora: { label: 'Lora', family: 'var(--rf-ff-lora)' },
  'system-sans': { label: 'System sans-serif', family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  'system-serif': { label: 'System serif', family: 'Georgia, "Times New Roman", serif' },
  'system-mono': { label: 'System monospace', family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
} as const

export type FontId = keyof typeof FONTS
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]]

export const COLOR_KEYS = ['accent', 'onAccent', 'accentText', 'ink', 'paper', 'canvas', 'muted'] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

export const ASSET_KINDS = ['logo', 'icon'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export const LIMITS = {
  nameMax: 60,
  displayWeight: { min: 400, max: 900 },
  baseSize: { min: 14, max: 20 },
  headingScale: { min: 0.8, max: 1.4 },
  assetBytes: 512 * 1024,
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** An http(s) URL (trailing slashes removed) or an absolute path; null for anything else. */
export function parseSiteUrl(value: string): string | null {
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return value.replace(/\/+$/, '')
  } catch {}
  return null
}

// #abc → #aabbcc, lower case: the form for <input type="color">.
const color = z
  .string()
  .trim()
  .regex(HEX_COLOR)
  .transform((v) => (v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v).toLowerCase())

export const brandingSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  siteUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined
      const url = parseSiteUrl(value)
      if (url) return url
      ctx.addIssue({ code: 'custom', message: 'must be an http(s) URL or an absolute path' })
      return z.NEVER
    }),
  colors: z.object(Object.fromEntries(COLOR_KEYS.map((key) => [key, color])) as Record<ColorKey, typeof color>),
  typography: z.object({
    displayFont: z.enum(FONT_IDS),
    bodyFont: z.enum(FONT_IDS),
    displayWeight: z.coerce.number().int().multipleOf(100).min(LIMITS.displayWeight.min).max(LIMITS.displayWeight.max),
    baseSize: z.coerce.number().int().min(LIMITS.baseSize.min).max(LIMITS.baseSize.max),
    headingScale: z.coerce
      .number()
      .min(LIMITS.headingScale.min)
      .max(LIMITS.headingScale.max)
      .transform((v) => Math.round(v * 100) / 100),
  }),
})

export type BrandingSettings = z.output<typeof brandingSchema>

/** Settings plus the URLs of uploaded images (versioned so they can be cached forever). */
export type Branding = BrandingSettings & { logoUrl?: string; iconUrl?: string }

export const DEFAULT_BRANDING: BrandingSettings = {
  name: 'Reform',
  siteUrl: undefined,
  colors: {
    accent: '#7dd3fc',
    onAccent: '#0c1a24',
    accentText: '#0369a1',
    ink: '#14130f',
    paper: '#ffffff',
    canvas: '#f3f2ee',
    muted: '#5c5a52',
  },
  typography: {
    displayFont: 'anybody',
    bodyFont: 'space-grotesk',
    displayWeight: 800,
    baseSize: 16,
    headingScale: 1,
  },
}

/** Stored settings merged over the defaults; anything unreadable falls back to the defaults. */
export function parseStoredBranding(stored: unknown): BrandingSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<keyof BrandingSettings, unknown>>
  const section = (value: unknown) => (value && typeof value === 'object' ? value : {})
  const merged = {
    ...DEFAULT_BRANDING,
    ...s,
    colors: { ...DEFAULT_BRANDING.colors, ...section(s.colors) },
    typography: { ...DEFAULT_BRANDING.typography, ...section(s.typography) },
  }
  const result = brandingSchema.safeParse(merged)
  return result.success ? result.data : DEFAULT_BRANDING
}

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/x-icon' | 'image/svg+xml'

/** Detects the image type from the file's first bytes; the browser-supplied type is not trusted. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp'
  if (starts(0x00, 0x00, 0x01, 0x00)) return 'image/x-icon'
  const head = new TextDecoder().decode(bytes.subarray(0, 1024)).replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'image/svg+xml'
  return null
}

export type ImageCheck = { ok: true; type: ImageType } | { ok: false; reason: 'tooLarge' | 'unsupported' }

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length > LIMITS.assetBytes) return { ok: false, reason: 'tooLarge' }
  const type = sniffImage(bytes)
  return type ? { ok: true, type } : { ok: false, reason: 'unsupported' }
}

/** CSS custom properties for <body>; colours are validated hex values and fonts come from FONTS only. */
export function brandingStyle(settings: BrandingSettings): Record<string, string> {
  const { colors, typography } = settings
  return {
    '--rf-accent': colors.accent,
    '--rf-on-accent': colors.onAccent,
    '--rf-accent-text': colors.accentText,
    '--rf-ink': colors.ink,
    '--rf-paper': colors.paper,
    '--rf-canvas': colors.canvas,
    '--rf-muted': colors.muted,
    '--rf-font-display': FONTS[typography.displayFont].family,
    '--rf-font-body': FONTS[typography.bodyFont].family,
    // The narrow width axis only exists in Anybody.
    '--rf-display-axes': typography.displayFont === 'anybody' ? '"wdth" 80' : 'normal',
    '--rf-display-weight': String(typography.displayWeight),
    '--rf-heading-scale': String(typography.headingScale),
  }
}
