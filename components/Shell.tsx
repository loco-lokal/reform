import type { ReactNode } from 'react'
import type { Language } from '@/lib/forms'
import { brand } from '@/lib/brand'
import { t } from '@/lib/i18n'
import { site } from '@/lib/site'
import { BrandMark } from './BrandMark'

/** Page frame: nav pill with the brand, content, legal links. */
export async function Shell({ lang, action, children }: { lang?: Language; action?: ReactNode; children: ReactNode }) {
  const s = site()
  const { name, siteUrl } = await brand()
  const language = lang ?? s.adminLanguage
  const logo = (
    <>
      <BrandMark className="rf-nav-mark" />
      {name}
    </>
  )
  return (
    <div className="rf-page" lang={language}>
      <header>
        <div className="rf-nav">
          {siteUrl ? (
            <a className="rf-nav-logo" href={siteUrl}>
              {logo}
            </a>
          ) : (
            <span className="rf-nav-logo">{logo}</span>
          )}
          {action}
        </div>
      </header>
      <main>{children}</main>
      <footer className="rf-page-footer">
        <span>
          © {new Date().getFullYear()} {name}
        </span>
        {s.imprintUrl && <a href={s.imprintUrl}>{t(language, 'imprint')}</a>}
        {s.privacyUrl && <a href={s.privacyUrl}>{t(language, 'privacy')}</a>}
      </footer>
    </div>
  )
}

/** Centered message card (thank-you, unavailable). */
export async function MessageCard({ eyebrow, title, text, lang }: { eyebrow?: string; title: string; text: string; lang: Language }) {
  const { siteUrl: url } = await brand()
  return (
    <section className="rf-contact">
      <div className="rf-contact-panel">
        <div className="rf-contact-head">
          {eyebrow && <span className="rf-contact-eyebrow">{eyebrow}</span>}
          <h1 className="rf-display rf-contact-title">{title}</h1>
          <p className="rf-contact-text">{text}</p>
        </div>
        {url && (
          <div className="rf-actions">
            <a className="rf-button" href={url}>
              {t(lang, 'backToSite')}
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
