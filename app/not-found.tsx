import { Shell } from '@/components/Shell'
import { t } from '@/lib/i18n'
import { site } from '@/lib/site'

export default function NotFound() {
  const lang = site().adminLanguage
  return (
    <Shell>
      <section className="rf-contact">
        <div className="rf-contact-panel">
          <div className="rf-contact-head">
            <span className="rf-contact-eyebrow">404</span>
            <h1 className="rf-display rf-contact-title">{t(lang, 'notFoundTitle')}</h1>
            <p className="rf-contact-text">{t(lang, 'notFoundText')}</p>
          </div>
        </div>
      </section>
    </Shell>
  )
}
