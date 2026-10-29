import type { Answers, Question } from './forms'
import type { MessageKey } from './i18n'

/** Name of the form field that carries the answer to a question. */
export function fieldName(question: Pick<Question, 'id'>): string {
  return `q_${question.id}`
}

/** Hidden field that only bots fill in. */
export const HONEYPOT_FIELD = 'website_url'

const MAX_LENGTH: Partial<Record<Question['type'], number>> = {
  short_text: 500,
  long_text: 10000,
  email: 254,
  phone: 40,
  number: 40,
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[0-9 ()/.-]{5,40}$/
const NUMBER = /^-?\d+(?:[.,]\d+)?$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function validDate(value: string): boolean {
  const m = DATE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

export type AnswerCheck = {
  answers: Answers
  /** Submitted values, to refill the form after a failed submit. */
  values: Answers
  errors: Record<string, MessageKey>
}

/** Reads and validates the answers to all questions from a submitted form. */
export function checkAnswers(questions: Question[], data: FormData): AnswerCheck {
  const answers: Answers = {}
  const values: Answers = {}
  const errors: Record<string, MessageKey> = {}

  for (const q of questions) {
    const raw = data.getAll(fieldName(q)).filter((v): v is string => typeof v === 'string')

    if (q.type === 'multiple_choice') {
      const selected = [...new Set(raw.map((v) => v.trim()).filter(Boolean))]
      values[q.id] = selected
      if (selected.some((v) => !q.options?.includes(v))) errors[q.id] = 'errorOption'
      else if (selected.length) answers[q.id] = q.options!.filter((o) => selected.includes(o))
      else if (q.required) errors[q.id] = 'errorRequired'
      continue
    }

    const value = (q.type === 'long_text' ? (raw[0] ?? '').replace(/\r\n/g, '\n') : (raw[0] ?? '')).trim()
    values[q.id] = value
    if (!value) {
      if (q.required) errors[q.id] = 'errorRequired'
      continue
    }
    const error = checkValue(q, value)
    if (error) errors[q.id] = error
    else answers[q.id] = value
  }
  return { answers, values, errors }
}

function checkValue(q: Question, value: string): MessageKey | undefined {
  const max = MAX_LENGTH[q.type]
  if (max && value.length > max) return 'errorTooLong'
  switch (q.type) {
    case 'email':
      return EMAIL.test(value) ? undefined : 'errorEmail'
    case 'phone':
      return PHONE.test(value) && /\d{4}/.test(value.replace(/\D/g, '')) ? undefined : 'errorPhone'
    case 'number':
      return NUMBER.test(value) ? undefined : 'errorNumber'
    case 'date':
      return validDate(value) ? undefined : 'errorDate'
    case 'single_choice':
    case 'dropdown':
      return q.options?.includes(value) ? undefined : 'errorOption'
    case 'yes_no':
      return value === 'yes' || value === 'no' ? undefined : 'errorOption'
    default:
      return undefined
  }
}
