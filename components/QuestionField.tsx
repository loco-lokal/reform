import { fieldName } from '@/lib/answers'
import type { Language, Question } from '@/lib/forms'
import { t } from '@/lib/i18n'

type Props = {
  question: Question
  lang: Language
  value?: string | string[]
  error?: string
}

const INPUT_TYPES: Partial<Record<Question['type'], { type: string; inputMode?: 'numeric' | 'decimal'; autoComplete?: string }>> = {
  short_text: { type: 'text' },
  email: { type: 'email', autoComplete: 'email' },
  phone: { type: 'tel', autoComplete: 'tel' },
  number: { type: 'text', inputMode: 'decimal' },
  date: { type: 'date' },
}

function Label({ question, lang }: { question: Question; lang: Language }) {
  return (
    <>
      {question.label}
      {question.required ? (
        <span className="rf-required" aria-hidden="true">
          *
        </span>
      ) : (
        <small>({t(lang, 'optional')})</small>
      )}
    </>
  )
}

/** One question as a labelled input, choice group or dropdown. */
export function QuestionField({ question: q, lang, value, error }: Props) {
  const id = `field-${q.id}`
  const name = fieldName(q)
  const describedBy = [q.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const help = q.help && (
    <span id={`${id}-help`} className="rf-field-help">
      {q.help}
    </span>
  )
  const errorText = error && (
    <span id={`${id}-error`} className="rf-field-error">
      {error}
    </span>
  )

  if (q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'yes_no') {
    const kind = q.type === 'multiple_choice' ? 'checkbox' : 'radio'
    const options: [string, string][] =
      q.type === 'yes_no' ? [['yes', t(lang, 'yes')], ['no', t(lang, 'no')]] : (q.options ?? []).map((o) => [o, o])
    const selected = Array.isArray(value) ? value : value ? [value] : []
    return (
      <div className="rf-contact-field">
        <fieldset
          className="rf-contact-services"
          // aria-required is not allowed on a plain group, only on a radiogroup.
          role={kind === 'radio' ? 'radiogroup' : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-required={q.required && kind === 'radio' ? true : undefined}
        >
          <legend>
            <Label question={q} lang={lang} />
          </legend>
          {options.map(([optionValue, optionLabel]) => (
            <label key={optionValue} className="rf-contact-service" data-kind={kind}>
              <input
                type={kind}
                name={name}
                value={optionValue}
                defaultChecked={selected.includes(optionValue)}
                required={kind === 'radio' && q.required}
              />
              {optionLabel}
            </label>
          ))}
        </fieldset>
        {help}
        {errorText}
      </div>
    )
  }

  const common = {
    id,
    name,
    required: q.required,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  }
  const current = typeof value === 'string' ? value : ''

  let control
  if (q.type === 'long_text') {
    control = <textarea {...common} rows={5} maxLength={10000} placeholder={q.placeholder} defaultValue={current} />
  } else if (q.type === 'dropdown') {
    control = (
      <select {...common} defaultValue={current}>
        <option value="">{q.placeholder || t(lang, 'choose')}</option>
        {(q.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  } else {
    const input = INPUT_TYPES[q.type] ?? { type: 'text' }
    control = <input {...common} {...input} maxLength={500} placeholder={q.placeholder} defaultValue={current} />
  }

  return (
    <div className="rf-contact-field">
      <label htmlFor={id}>
        <Label question={q} lang={lang} />
      </label>
      {help}
      {control}
      {errorText}
    </div>
  )
}
