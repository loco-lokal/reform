import { describe, expect, it } from 'vitest'
import { checkAnswers, fieldName } from '@/lib/answers'
import type { Question } from '@/lib/forms'

function data(entries: [string, string][]) {
  const fd = new FormData()
  for (const [k, v] of entries) fd.append(`q_${k}`, v)
  return fd
}

const q = (type: Question['type'], extra: Partial<Question> = {}): Question => ({ id: type, type, label: type, required: false, ...extra })

describe('checkAnswers', () => {
  it('uses q_<id> field names', () => {
    expect(fieldName({ id: 'budget' })).toBe('q_budget')
  })

  it('accepts valid answers of every type', () => {
    const questions = [
      q('short_text'),
      q('long_text'),
      q('email'),
      q('phone'),
      q('number'),
      q('date'),
      q('single_choice', { options: ['a', 'b'] }),
      q('multiple_choice', { options: ['a', 'b', 'c'] }),
      q('dropdown', { options: ['x', 'y'] }),
      q('yes_no'),
    ]
    const result = checkAnswers(
      questions,
      data([
        ['short_text', ' Bäckerei Schmidt '],
        ['long_text', 'Zeile 1\r\nZeile 2'],
        ['email', 'info@example.de'],
        ['phone', '+49 (0) 30 / 123-456'],
        ['number', '12,5'],
        ['date', '2026-02-28'],
        ['single_choice', 'b'],
        ['multiple_choice', 'c'],
        ['multiple_choice', 'a'],
        ['dropdown', 'y'],
        ['yes_no', 'no'],
      ]),
    )
    expect(result.errors).toEqual({})
    expect(result.answers).toEqual({
      short_text: 'Bäckerei Schmidt',
      long_text: 'Zeile 1\nZeile 2',
      email: 'info@example.de',
      phone: '+49 (0) 30 / 123-456',
      number: '12,5',
      date: '2026-02-28',
      single_choice: 'b',
      multiple_choice: ['a', 'c'],
      dropdown: 'y',
      yes_no: 'no',
    })
  })

  it('reports format errors and keeps the submitted values', () => {
    const questions = [q('email'), q('phone'), q('number'), q('date'), q('single_choice', { options: ['a', 'b'] }), q('yes_no')]
    const result = checkAnswers(
      questions,
      data([
        ['email', 'nope'],
        ['phone', 'call me'],
        ['number', '1e5'],
        ['date', '2026-02-30'],
        ['single_choice', 'c'],
        ['yes_no', 'maybe'],
      ]),
    )
    expect(result.errors).toEqual({
      email: 'errorEmail',
      phone: 'errorPhone',
      number: 'errorNumber',
      date: 'errorDate',
      single_choice: 'errorOption',
      yes_no: 'errorOption',
    })
    expect(result.answers).toEqual({})
    expect(result.values.email).toBe('nope')
  })

  it('enforces required fields and skips empty optional ones', () => {
    const result = checkAnswers(
      [q('short_text', { required: true }), q('multiple_choice', { required: true, options: ['a', 'b'] }), q('email')],
      data([['short_text', '   ']]),
    )
    expect(result.errors).toEqual({ short_text: 'errorRequired', multiple_choice: 'errorRequired' })
    expect(result.answers).toEqual({})
  })

  it('rejects unknown options and overly long text', () => {
    const result = checkAnswers(
      [q('multiple_choice', { options: ['a', 'b'] }), q('short_text')],
      data([
        ['multiple_choice', 'a'],
        ['multiple_choice', 'evil'],
        ['short_text', 'x'.repeat(501)],
      ]),
    )
    expect(result.errors).toEqual({ multiple_choice: 'errorOption', short_text: 'errorTooLong' })
  })
})
