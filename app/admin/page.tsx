import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminShell } from '@/components/AdminShell'
import { StatusBadge } from '@/components/StatusBadge'
import { requireAdmin } from '@/lib/auth'
import { formatDateTime, plural, t } from '@/lib/i18n'
import { listForms } from '@/lib/repo'
import { site } from '@/lib/site'

export function generateMetadata(): Metadata {
  return { title: t(site().adminLanguage, 'adminForms') }
}

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  await requireAdmin()
  const forms = await listForms()
  const lang = site().adminLanguage
  return (
    <AdminShell>
      <section className="rf-contact" data-wide="true">
        <div className="rf-contact-panel">
          <div className="rf-contact-head">
            <span className="rf-contact-eyebrow">Admin</span>
            <h1 className="rf-display rf-contact-title">{t(lang, 'adminForms')}</h1>
            <p className="rf-contact-text">
              {forms.length
                ? `${plural(lang, forms.length, 'adminFormOne', 'adminFormMany')}, ${t(lang, 'adminNewestFirst')}.`
                : t(lang, 'adminNoForms')}
            </p>
          </div>
          {forms.length > 0 && (
            <div className="rf-table-wrap">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th>{t(lang, 'adminTitle')}</th>
                    <th>{t(lang, 'mdReference')}</th>
                    <th>{t(lang, 'mdCreated')}</th>
                    <th>{t(lang, 'adminExpires')}</th>
                    <th>{t(lang, 'mdStatus')}</th>
                    <th>{t(lang, 'adminResponses')}</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((form) => (
                    <tr key={form.id}>
                      <td>
                        <Link href={`/admin/forms/${form.id}`}>{form.title}</Link>
                      </td>
                      <td>{form.reference || '–'}</td>
                      <td>{formatDateTime(lang, form.createdAt)}</td>
                      <td>
                        {[form.singleUse && t(lang, 'adminAfterFirst'), form.expiresAt && formatDateTime(lang, form.expiresAt)]
                          .filter(Boolean)
                          .join(` ${t(lang, 'adminOr')} `)}
                      </td>
                      <td>
                        <StatusBadge form={form} lang={lang} />
                      </td>
                      <td>{form.responseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  )
}
