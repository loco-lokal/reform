import type { Metadata } from 'next'
import { AdminShell } from '@/components/AdminShell'
import { BrandingForm } from '@/components/BrandingForm'
import { requireAdmin } from '@/lib/auth'
import { brand } from '@/lib/brand'
import { brandingLabels, t } from '@/lib/i18n'
import { site } from '@/lib/site'

export function generateMetadata(): Metadata {
  return { title: t(site().adminLanguage, 'brandingTitle') }
}

export const dynamic = 'force-dynamic'

export default async function BrandingPage() {
  await requireAdmin()
  const { logoUrl, iconUrl, ...settings } = await brand()
  const lang = site().adminLanguage
  return (
    <AdminShell>
      <section className="rf-contact" data-wide="true">
        <div className="rf-contact-panel">
          <div className="rf-contact-head">
            <span className="rf-contact-eyebrow">Admin</span>
            <h1 className="rf-display rf-contact-title">{t(lang, 'brandingTitle')}</h1>
            <p className="rf-contact-text">{t(lang, 'brandingIntro')}</p>
          </div>
          <BrandingForm initial={settings} images={{ logo: logoUrl, icon: iconUrl }} labels={brandingLabels(lang)} />
        </div>
      </section>
    </AdminShell>
  )
}
