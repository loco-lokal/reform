import { NextResponse, type NextRequest } from 'next/server'
import { config as serviceConfig } from '@/lib/config'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

// Optimistic guard for the admin area; pages, actions and the export route check the session again.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/login') return NextResponse.next()
  const valid = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, serviceConfig().sessionSecret)
  if (valid) return NextResponse.next()
  return NextResponse.redirect(new URL('/admin/login', request.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
