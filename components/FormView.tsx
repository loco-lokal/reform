'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { submitForm, type SubmitState } from '@/app/f/[token]/actions'
import { HONEYPOT_FIELD, TOKEN_FIELD } from '@/lib/answers'
import type { Language, Question } from '@/lib/forms'
import { t } from '@/lib/i18n'
import { QuestionField } from './QuestionField'

const initialState: SubmitState = { attempt: 0, values: {}, errors: {} }

function SubmitButton({ lang }: { lang: Language }) {
  const { pending } = useFormStatus()
  return (
    <button className="rf-contact-submit" type="submit" disabled={pending}>
      {t(lang, pending ? 'submitting' : 'submit')}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  )
}

export function FormView({ token, lang, questions }: { token: string; lang: Language; questions: Question[] }) {
  const [state, action] = useActionState(submitForm, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // After a failed submit, move to the first invalid field (or the message when none is marked).
  useEffect(() => {
    if (!state.formError) return
    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    const focusable = target?.matches('fieldset') ? target.querySelector<HTMLElement>('input') : target
    if (focusable) focusable.focus()
    ;(target ?? formRef.current)?.scrollIntoView({ block: 'center' })
  }, [state])

  return (
    // The key remounts the form after a failed submit so fields show the returned values.
    <form ref={formRef} key={state.attempt} className="rf-contact-form" action={action} noValidate>
      {state.formError && (
        <p className="rf-contact-status" data-state="error" role="alert">
          {state.formError}
        </p>
      )}
      <input type="hidden" name={TOKEN_FIELD} value={token} />
      {questions.map((q) => (
        <QuestionField key={q.id} question={q} lang={lang} value={state.values[q.id]} error={state.errors[q.id]} />
      ))}
      <div className="rf-honeypot" aria-hidden="true">
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton lang={lang} />
    </form>
  )
}
