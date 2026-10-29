import { NextResponse, type NextRequest } from 'next/server'
import { safeEqual } from '@/lib/auth'
import { config } from '@/lib/config'
import { parseCreateRequest } from '@/lib/forms'
import { createForm } from '@/lib/repo'

const MAX_BODY_BYTES = 256 * 1024

function error(status: number, code: string, message: string, extra?: object) {
  return NextResponse.json({ code, message, ...extra }, { status })
}

// POST /api/forms creates a form and returns its public link (see CONTRACT.md).
export async function POST(request: NextRequest) {
  if (!safeEqual(request.headers.get('x-api-key') ?? '', config().apiSecret)) {
    return error(401, 'unauthorized', 'invalid api key')
  }
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return error(413, 'too_large', 'request body exceeds 256 KB')
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return error(400, 'invalid_json', 'request body must be JSON')
  }
  const parsed = parseCreateRequest(body)
  if (!parsed.ok) return error(400, 'invalid_request', 'request validation failed', { issues: parsed.issues })

  const form = await createForm(parsed.form)
  return NextResponse.json(
    {
      id: form.id,
      url: `${config().publicUrl}/f/${form.token}`,
      expiresAt: form.expiresAt?.toISOString() ?? null,
      singleUse: form.singleUse,
    },
    { status: 201 },
  )
}
