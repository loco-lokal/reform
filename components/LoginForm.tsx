'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/app/admin/actions'

export function LoginForm({ passwordLabel, submitLabel }: { passwordLabel: string; submitLabel: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})
  return (
    <form className="rf-contact-form" action={action}>
      {state.error && (
        <p className="rf-contact-status" data-state="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="rf-contact-field">
        <label htmlFor="password">{passwordLabel}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </div>
      <button className="rf-contact-submit" type="submit" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  )
}
