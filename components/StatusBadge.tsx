import { formStatus, type Form, type Language } from '@/lib/forms'
import { statusLabel } from '@/lib/i18n'

export function StatusBadge({ form, lang }: { form: Pick<Form, 'closedAt' | 'expiresAt'>; lang: Language }) {
  const status = formStatus(form)
  return (
    <span className="rf-status" data-status={status}>
      {statusLabel(lang, status)}
    </span>
  )
}
