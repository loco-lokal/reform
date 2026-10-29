'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { HONEYPOT_FIELD, TOKEN_FIELD, checkAnswers } from '@/lib/answers'
import { clientIp } from '@/lib/auth'
import { config } from '@/lib/config'
import { formStatus, type Answers } from '@/lib/forms'
import { t } from '@/lib/i18n'
import { RateLimiter } from '@/lib/ratelimit'
import { getFormByToken, submitResponse } from '@/lib/repo'

export type SubmitState = {
  /** Increments on every failed submit so the form remounts with the returned values. */
  attempt: number
  values: Answers
  errors: Record<string, string>
  formError?: string
}

let limiter: RateLimiter | undefined

// The token comes from a hidden field rather than a bound argument: with a bound action, a submit without
// JavaScript that fails validation never got a response.
export async function submitForm(prev: SubmitState, data: FormData): Promise<SubmitState> {
  const token = String(data.get(TOKEN_FIELD) ?? '')
  const form = await getFormByToken(token)
  if (!form) redirect(`/f/${encodeURIComponent(token)}`)
  const lang = form.language
  const thanks = `/f/${encodeURIComponent(token)}/thanks`

  // Bots fill the hidden field: pretend success, store nothing.
  if (String(data.get(HONEYPOT_FIELD) ?? '')) redirect(thanks)

  const { answers, values, errors } = checkAnswers(form.questions, data)
  const attempt = prev.attempt + 1

  limiter ??= new RateLimiter(config().submitRateLimitPerHour, 60 * 60 * 1000)
  if (!limiter.hit(clientIp(await headers()))) {
    return { attempt, values, errors: {}, formError: t(lang, 'errorRateLimited') }
  }
  if (formStatus(form) !== 'open') redirect(`/f/${encodeURIComponent(token)}`)

  if (Object.keys(errors).length) {
    const messages = Object.fromEntries(Object.entries(errors).map(([id, key]) => [id, t(lang, key)]))
    return { attempt, values, errors: messages, formError: t(lang, 'errorSummary') }
  }

  const result = await submitResponse(token, answers)
  if (result !== 'ok') redirect(`/f/${encodeURIComponent(token)}`)
  redirect(thanks)
}
