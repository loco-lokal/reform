import Link from 'next/link'
import type { ReactNode } from 'react'
import { logout } from '@/app/admin/actions'
import { t } from '@/lib/i18n'
import { site } from '@/lib/site'
import { Shell } from './Shell'

export function AdminShell({ children }: { children: ReactNode }) {
  const lang = site().adminLanguage
  return (
    <Shell
      action={
        <>
          <Link className="rf-nav-link" href="/admin">
            {t(lang, 'adminForms')}
          </Link>
          <Link className="rf-nav-link" href="/admin/branding">
            {t(lang, 'brandingNav')}
          </Link>
          <form action={logout}>
            <button className="rf-nav-cta" type="submit">
              {t(lang, 'adminLogout')}
            </button>
          </form>
        </>
      }
    >
      {children}
    </Shell>
  )
}
