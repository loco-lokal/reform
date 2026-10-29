'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clientIp, requireAdmin, safeEqual } from '@/lib/auth'
import { ASSET_KINDS, COLOR_KEYS, LIMITS, brandingSchema, checkImage, type AssetKind } from '@/lib/branding'
import { config } from '@/lib/config'
import { t } from '@/lib/i18n'
import { RateLimiter } from '@/lib/ratelimit'
import { resetBranding, saveBranding } from '@/lib/repo'
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSession } from '@/lib/session'
import { site } from '@/lib/site'

const loginLimiter = new RateLimiter(10, 15 * 60 * 1000)

export type LoginState = { error?: string }

export async function login(_prev: LoginState, data: FormData): Promise<LoginState> {
  if (!loginLimiter.hit(clientIp(await headers()))) {
    return { error: t(site().adminLanguage, 'adminLoginRateLimited') }
  }
  if (!safeEqual(String(data.get('password') ?? ''), config().adminPassword)) {
    return { error: t(site().adminLanguage, 'adminWrongPassword') }
  }
  const store = await cookies()
  store.set(SESSION_COOKIE, await createSession(config().sessionSecret), {
    httpOnly: true,
    // Follows the public URL, not NODE_ENV: browsers such as Safari drop Secure cookies on plain http,
    // which would sign the admin out on the next request of a local production build.
    secure: config().publicUrl.startsWith('https://'),
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  redirect('/admin')
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/admin/login')
}

export type BrandingState = { saved?: boolean; error?: string; fields?: Record<string, string> }

// Form field names are the last segment of each setting's path (accent, baseSize, …) and the image kinds.
export async function saveBrandingAction(_prev: BrandingState, data: FormData): Promise<BrandingState> {
  await requireAdmin()
  const lang = site().adminLanguage
  const field = (name: string) => String(data.get(name) ?? '')
  const parsed = brandingSchema.safeParse({
    name: field('name'),
    siteUrl: field('siteUrl'),
    colors: Object.fromEntries(COLOR_KEYS.map((key) => [key, field(key)])),
    typography: {
      displayFont: field('displayFont'),
      bodyFont: field('bodyFont'),
      displayWeight: field('displayWeight'),
      baseSize: field('baseSize'),
      headingScale: field('headingScale'),
    },
  })
  const fields: Record<string, string> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fields[String(issue.path.at(-1))] = t(lang, 'brandingInvalidField')
  }

  const assets: Partial<Record<AssetKind, { contentType: string; data: Uint8Array } | null>> = {}
  for (const kind of ASSET_KINDS) {
    if (data.get(`${kind}Remove`) === 'on') {
      assets[kind] = null
      continue
    }
    const file = data.get(kind)
    if (!(file instanceof File) || file.size === 0) continue
    if (file.size > LIMITS.assetBytes) {
      fields[kind] = t(lang, 'brandingImageTooLarge')
      continue
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const check = checkImage(bytes)
    if (!check.ok) {
      fields[kind] = t(lang, check.reason === 'tooLarge' ? 'brandingImageTooLarge' : 'brandingImageUnsupported')
      continue
    }
    assets[kind] = { contentType: check.type, data: bytes }
  }

  if (!parsed.success || Object.keys(fields).length) return { error: t(lang, 'brandingInvalid'), fields }
  await saveBranding(parsed.data, assets)
  revalidatePath('/', 'layout')
  return { saved: true }
}

export async function resetBrandingAction(): Promise<void> {
  await requireAdmin()
  await resetBranding()
  revalidatePath('/', 'layout')
}
