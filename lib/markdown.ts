import { formStatus, type Form, type FormResponse, type Question } from './forms'
import { formatDate, formatDateTime, statusLabel, t } from './i18n'

/** Escapes inline Markdown so user input renders as plain text. */
export function escapeInline(text: string): string {
  return text.replace(/[\\`*_[\]<>|#~]/g, '\\$&')
}

/** Escapes multi-line text: inline syntax plus block markers at line starts; keeps line breaks. */
export function escapeBlock(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      escapeInline(line.trimEnd())
        .replace(/^(\s*)([-+])(?=\s|$)/, '$1\\$2')
        .replace(/^(\s*)(=+|-{2,})$/, '$1\\$2')
        .replace(/^(\s*\d+)([.)])(?=\s|$)/, '$1\\$2'),
    )
    .join('  \n')
    .replace(/(  \n){2,}/g, '\n\n')
}

function answerText(form: Form, q: Question, value: string | string[] | undefined): string {
  const lang = form.language
  if (value === undefined || value.length === 0) return t(lang, 'mdNoAnswer')
  if (Array.isArray(value)) return value.map((v) => `- ${escapeInline(v)}`).join('\n')
  if (q.type === 'yes_no') return t(lang, value === 'yes' ? 'yes' : 'no')
  if (q.type === 'date') return formatDate(lang, value)
  return escapeBlock(value)
}

/** Renders a form and all its responses as a Markdown document. */
export function renderMarkdown(form: Form, responses: FormResponse[], now = new Date()): string {
  const lang = form.language
  const meta = [
    form.reference && `${t(lang, 'mdReference')}: ${escapeInline(form.reference)}`,
    `${t(lang, 'mdCreated')}: ${formatDateTime(lang, form.createdAt)}`,
    `${t(lang, 'mdStatus')}: ${statusLabel(lang, formStatus(form, now))}`,
    `${t(lang, 'mdResponses')}: ${responses.length}`,
  ].filter(Boolean)

  const out = [`# ${escapeInline(form.title)}`, '', ...meta.map((m) => `- ${m}`), '']
  if (!responses.length) out.push(t(lang, 'mdNoResponses'), '')

  responses.forEach((response, index) => {
    const heading = responses.length > 1 ? `${t(lang, 'mdResponse')} ${index + 1} — ` : `${t(lang, 'mdResponse')} — `
    out.push(`## ${heading}${formatDateTime(lang, response.submittedAt)}`, '')
    for (const q of form.questions) {
      out.push(`### ${escapeInline(q.label)}`, '', answerText(form, q, response.answers[q.id]), '')
    }
  })
  return out.join('\n').replace(/\n+$/, '\n')
}

/** File name for the export, e.g. "customer-survey.md". */
export function exportFileName(form: Pick<Form, 'title'>): string {
  const slug = form.title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${slug || 'form'}.md`
}
