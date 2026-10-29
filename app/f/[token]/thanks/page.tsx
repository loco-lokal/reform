import { notFound } from 'next/navigation'
import { MessageCard, Shell } from '@/components/Shell'
import { t } from '@/lib/i18n'
import { getFormByToken } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export default async function ThanksPage({ params }: { params: Promise<{ token: string }> }) {
  const form = await getFormByToken((await params).token)
  if (!form) notFound()
  const lang = form.language
  return (
    <Shell lang={lang}>
      <MessageCard lang={lang} eyebrow={form.title} title={t(lang, 'thanksTitle')} text={t(lang, 'thanksText')} />
    </Shell>
  )
}
