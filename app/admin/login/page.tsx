import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { Shell } from '@/components/Shell'
import { isAdmin } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { site } from '@/lib/site'

export function generateMetadata(): Metadata {
  return { title: t(site().adminLanguage, 'adminLogin') }
}

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin')
  const lang = site().adminLanguage
  return (
    <Shell>
      <section className="rf-contact" style={{ width: 'min(480px, 100%)' }}>
        <div className="rf-contact-panel">
          <div className="rf-contact-head">
            <span className="rf-contact-eyebrow">{t(lang, 'adminForms')}</span>
            <h1 className="rf-display rf-contact-title">{t(lang, 'adminLogin')}</h1>
          </div>
          <LoginForm passwordLabel={t(lang, 'adminPassword')} submitLabel={t(lang, 'adminLogin')} />
        </div>
      </section>
    </Shell>
  )
}
