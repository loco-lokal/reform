import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { config } from './config'
import { SESSION_COOKIE, verifySession } from './session'

/** Constant-time string comparison (hashing first makes the lengths equal). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value, config().sessionSecret)
}

/** Redirects to the login page unless the request carries a valid admin session. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login')
}

/** Visitor IP as forwarded by the reverse proxy in front of the service. */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}
