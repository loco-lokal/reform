import { describe, expect, it } from 'vitest'
import { QUESTION_TYPES, formStatus, parseCreateRequest } from '@/lib/forms'

const now = new Date('2026-10-28T12:00:00Z')
const base = {
  title: 'Fragebogen',
  lifetime: { singleUse: true },
  questions: [{ type: 'short_text', label: 'Name' }],
}

function issues(body: unknown) {
  const result = parseCreateRequest(body, now)
  if (result.ok) throw new Error('expected validation to fail')
  return result.issues
}

describe('parseCreateRequest', () => {
  it('fills in defaults and generated ids', () => {
    const result = parseCreateRequest(
      { ...base, questions: [{ type: 'short_text', label: 'A' }, { id: 'q1', type: 'long_text', label: 'B' }, { type: 'email', label: 'C' }] },
      now,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.form.language).toBe('en')
    expect(result.form.description).toBe('')
    expect(result.form.expiresAt).toBeNull()
    expect(result.form.questions.map((q) => q.id)).toEqual(['q2', 'q1', 'q3'])
    expect(result.form.questions[0].required).toBe(false)
  })

  it('accepts every question type', () => {
    const questions = QUESTION_TYPES.map((type) =>
      ['single_choice', 'multiple_choice', 'dropdown'].includes(type) ? { type, label: type, options: ['a', 'b'] } : { type, label: type },
    )
    expect(parseCreateRequest({ ...base, questions }, now).ok).toBe(true)
  })

  it('requires a lifetime', () => {
    expect(issues({ ...base, lifetime: {} })).toEqual([{ path: 'lifetime', message: expect.any(String) }])
    expect(issues({ ...base, lifetime: undefined })[0].path).toBe('lifetime')
  })

  it('accepts a future expiry date with or without single use', () => {
    const result = parseCreateRequest({ ...base, lifetime: { expiresAt: '2026-12-01T23:59:59+01:00' } }, now)
    expect(result.ok && result.form.expiresAt?.toISOString()).toBe('2026-12-01T22:59:59.000Z')
    expect(parseCreateRequest({ ...base, lifetime: { singleUse: true, expiresAt: '2026-11-01T00:00:00Z' } }, now).ok).toBe(true)
  })

  it('rejects past or malformed expiry dates', () => {
    expect(issues({ ...base, lifetime: { expiresAt: '2026-10-01T00:00:00Z' } })[0].path).toBe('lifetime.expiresAt')
    expect(issues({ ...base, lifetime: { expiresAt: 'tomorrow' } })[0].path).toBe('lifetime.expiresAt')
  })

  it('checks options of choice questions', () => {
    expect(issues({ ...base, questions: [{ type: 'dropdown', label: 'X' }] })[0].path).toBe('questions[0].options')
    expect(issues({ ...base, questions: [{ type: 'single_choice', label: 'X', options: ['a'] }] })[0].path).toBe('questions[0].options')
    expect(issues({ ...base, questions: [{ type: 'multiple_choice', label: 'X', options: ['a', 'a'] }] })[0].message).toMatch(/unique/)
    expect(issues({ ...base, questions: [{ type: 'short_text', label: 'X', options: ['a', 'b'] }] })[0].path).toBe('questions[0].options')
  })

  it('rejects duplicate and malformed ids, unknown types and empty forms', () => {
    expect(
      issues({ ...base, questions: [{ id: 'a', type: 'email', label: 'X' }, { id: 'a', type: 'email', label: 'Y' }] })[0].path,
    ).toBe('questions[1].id')
    expect(issues({ ...base, questions: [{ id: 'Not Valid', type: 'email', label: 'X' }] })[0].path).toBe('questions[0].id')
    expect(issues({ ...base, questions: [{ type: 'signature', label: 'X' }] })[0].path).toBe('questions[0].type')
    expect(issues({ ...base, questions: [] })[0].path).toBe('questions')
    expect(issues({ ...base, title: '  ' })[0].path).toBe('title')
    expect(issues({ ...base, language: 'fr' })[0].path).toBe('language')
  })
})

describe('formStatus', () => {
  it('reports closed, expired and open forms', () => {
    expect(formStatus({ closedAt: now, expiresAt: null }, now)).toBe('closed')
    expect(formStatus({ closedAt: null, expiresAt: now }, now)).toBe('expired')
    expect(formStatus({ closedAt: null, expiresAt: new Date(now.getTime() + 1) }, now)).toBe('open')
    expect(formStatus({ closedAt: null, expiresAt: null }, now)).toBe('open')
  })
})
