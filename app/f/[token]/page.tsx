import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { FormView } from '@/components/FormView'
import { MessageCard, Shell } from '@/components/Shell'
import { formStatus } from '@/lib/forms'
import { formatDateTime, t } from '@/lib/i18n'
import { getFormByToken } from '@/lib/repo'
import { brand } from '@/lib/brand'

export const dynamic = 'force-dynamic'

const loadForm = cache(getFormByToken)

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const form = await loadForm((await params).token)
  return { title: form?.title ?? 'Form' }
}

export default async function FormPage({ params }: Props) {
  const { token } = await params
  const form = await loadForm(token)
  if (!form) notFound()
  const lang = form.language
  const { name } = await brand()

  if (formStatus(form) !== 'open') {
    return (
      <Shell lang={lang}>
        <MessageCard lang={lang} title={t(lang, 'unavailableTitle')} text={t(lang, 'unavailableText')} />
      </Shell>
    )
  }

  return (
    <Shell lang={lang}>
      <section className="rf-contact">
        <div className="rf-contact-panel">
          <div className="rf-contact-head">
            <span className="rf-contact-eyebrow">{name}</span>
            <h1 className="rf-display rf-contact-title">{form.title}</h1>
            {form.description && <p className="rf-contact-text">{form.description}</p>}
            {form.expiresAt && (
              <p className="rf-contact-hint">
                {t(lang, 'expiresOn')} {formatDateTime(lang, form.expiresAt)}
              </p>
            )}
          </div>
          <FormView token={token} lang={lang} questions={form.questions} />
        </div>
      </section>
    </Shell>
  )
}
