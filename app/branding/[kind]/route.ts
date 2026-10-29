import { NextResponse } from 'next/server'
import { ASSET_KINDS, type AssetKind } from '@/lib/branding'
import { getBrandingAsset } from '@/lib/repo'

export const dynamic = 'force-dynamic'

// GET /branding/logo and /branding/icon serve the images uploaded in the admin. Pages link them with
// ?v=<upload time>, so a response can be cached for good: a new upload gets a new URL.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const kind = (await params).kind
  if (!(ASSET_KINDS as readonly string[]).includes(kind)) return notFound()
  const asset = await getBrandingAsset(kind as AssetKind)
  if (!asset) return notFound()
  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Last-Modified': asset.updatedAt.toUTCString(),
      // An SVG opened directly is a document: no scripts, no external loads.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}

function notFound() {
  return NextResponse.json({ code: 'not_found', message: 'no such image' }, { status: 404 })
}
