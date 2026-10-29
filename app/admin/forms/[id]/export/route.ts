import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { exportFileName, renderMarkdown } from '@/lib/markdown'
import { getForm, listResponses } from '@/lib/repo'

// GET /admin/forms/{id}/export downloads all responses of a form as Markdown.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ code: 'unauthorized', message: 'login required' }, { status: 401 })
  const form = await getForm((await params).id)
  if (!form) return NextResponse.json({ code: 'not_found', message: 'form not found' }, { status: 404 })
  const markdown = renderMarkdown(form, await listResponses(form.id))
  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFileName(form)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
