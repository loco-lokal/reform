import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/AdminShell'
import { CopyButton } from '@/components/CopyButton'
import { StatusBadge } from '@/components/StatusBadge'
import { requireAdmin } from '@/lib/auth'
import { config } from '@/lib/config'
import type { Form, Language, Question } from '@/lib/forms'
import { formatDate, formatDateTime, plural, t } from '@/lib/i18n'
import { renderMarkdown } from '@/lib/markdown'
import { getForm, listResponses } from '@/lib/repo'
import { site } from '@/lib/site'

export function generateMetadata(): Metadata {
  return { title: t(site().adminLanguage, 'adminResponses') }
}

export const dynamic = 'force-dynamic'

function Answer({ form, question, value, lang }: { form: Form; question: Question; value: string | string[] | undefined; lang: Language }) {
  if (value === undefined || value.length === 0) return <em>{t(lang, 'adminNoAnswer')}</em>
  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    )
  }
  // Answers are shown in the form's language, like in the export.
  if (question.type === 'yes_no') return <>{t(form.language, value === 'yes' ? 'yes' : 'no')}</>
  if (question.type === 'date') return <>{formatDate(form.language, value)}</>
  return <>{value}</>
}

export default async function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const form = await getForm((await params).id)
  if (!form) notFound()
  const responses = await listResponses(form.id)
  const markdown = renderMarkdown(form, responses)
  const url = `${config().publicUrl}/f/${form.token}`
  const lang = site().adminLanguage

  return (
    <AdminShell>
      <section className="rf-contact" data-wide="true">
        <div className="rf-contact-panel">
          <div className="rf-contact-head">
            <Link className="rf-contact-eyebrow" href="/admin">
              {t(lang, 'adminAllForms')}
            </Link>
            <h1 className="rf-display rf-contact-title">{form.title}</h1>
            <div className="rf-meta">
              <StatusBadge form={form} lang={lang} />
              <span className="rf-eyebrow">
                {t(lang, 'mdCreated')} {formatDateTime(lang, form.createdAt)}
              </span>
              {form.reference && (
                <span className="rf-eyebrow">
                  {t(lang, 'mdReference')} {form.reference}
                </span>
              )}
              <span className="rf-eyebrow">{form.language.toUpperCase()}</span>
              <span className="rf-eyebrow">{plural(lang, responses.length, 'adminResponseOne', 'adminResponseMany')}</span>
            </div>
            <a className="rf-link rf-contact-hint" href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </div>

          {responses.length === 0 && <p className="rf-contact-text">{t(lang, 'adminNoResponses')}</p>}
          {responses.map((response, index) => (
            <article key={response.id} className="rf-response">
              <h2 className="rf-display">
                {t(lang, 'mdResponse')} {index + 1} · {formatDateTime(lang, response.submittedAt)}
              </h2>
              <dl>
                {form.questions.map((q) => (
                  <div key={q.id}>
                    <dt>{q.label}</dt>
                    <dd>
                      <Answer form={form} question={q} value={response.answers[q.id]} lang={lang} />
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}

          <div className="rf-contact-head">
            <h2 className="rf-display" style={{ fontSize: 28 }}>
              {t(lang, 'adminExport')}
            </h2>
            <div className="rf-actions">
              <CopyButton text={markdown} label={t(lang, 'adminCopy')} copiedLabel={t(lang, 'adminCopied')} />
              <a className="rf-button" data-tone="soft" href={`/admin/forms/${form.id}/export`}>
                {t(lang, 'adminDownload')}
              </a>
            </div>
          </div>
          <pre className="rf-markdown">{markdown}</pre>
        </div>
      </section>
    </AdminShell>
  )
}
