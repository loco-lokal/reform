import { describe, expect, it } from 'vitest'
import type { Form, FormResponse } from '@/lib/forms'
import { escapeBlock, escapeInline, exportFileName, renderMarkdown } from '@/lib/markdown'

const form: Form = {
  id: '00000000-0000-4000-8000-000000000001',
  token: 'token',
  title: 'Fragebogen *Erstberatung*',
  description: '',
  language: 'de',
  reference: 'opp-42',
  singleUse: true,
  expiresAt: null,
  closedAt: new Date('2026-10-28T13:05:00Z'),
  createdAt: new Date('2026-10-27T09:00:00Z'),
  questions: [
    { id: 'name', type: 'short_text', label: 'Wie heißt du?', required: true },
    { id: 'notes', type: 'long_text', label: 'Notizen', required: false },
    { id: 'goals', type: 'multiple_choice', label: 'Ziele', required: false, options: ['Anfragen', 'Shop'] },
    { id: 'domain', type: 'yes_no', label: 'Domain vorhanden?', required: false },
    { id: 'start', type: 'date', label: 'Start', required: false },
    { id: 'phone', type: 'phone', label: 'Telefon', required: false },
  ],
}

const response: FormResponse = {
  id: 'r1',
  formId: form.id,
  submittedAt: new Date('2026-10-28T13:05:00Z'),
  answers: { name: 'Max # Muster', notes: '# Überschrift\n- Punkt\n\nNeuer Absatz', goals: ['Anfragen', 'Shop'], domain: 'yes', start: '2026-11-03' },
}

describe('renderMarkdown', () => {
  it('renders a single response', () => {
    expect(renderMarkdown(form, [response], new Date('2026-10-29T00:00:00Z'))).toMatchInlineSnapshot(`
      "# Fragebogen \\*Erstberatung\\*

      - Referenz: opp-42
      - Erstellt: 27.10.2026, 09:00
      - Status: abgeschlossen
      - Antworten: 1

      ## Antwort — 28.10.2026, 13:05

      ### Wie heißt du?

      Max \\# Muster

      ### Notizen

      \\# Überschrift  
      \\- Punkt

      Neuer Absatz

      ### Ziele

      - Anfragen
      - Shop

      ### Domain vorhanden?

      Ja

      ### Start

      03.11.2026

      ### Telefon

      _keine Angabe_
      "
    `)
  })

  it('numbers multiple responses and localises English forms', () => {
    const md = renderMarkdown({ ...form, language: 'en', closedAt: null }, [response, { ...response, id: 'r2' }])
    expect(md).toContain('## Response 1 — ')
    expect(md).toContain('## Response 2 — ')
    expect(md).toContain('- Status: open')
    expect(md).toContain('_no answer_')
    expect(md).toContain('\nYes\n')
  })

  it('says when there are no responses', () => {
    expect(renderMarkdown(form, [])).toContain('_Noch keine Antworten._')
  })
})

describe('escaping', () => {
  it('neutralises inline and block syntax', () => {
    expect(escapeInline('[link](x) <b> a|b')).toBe('\\[link\\](x) \\<b\\> a\\|b')
    expect(escapeBlock('1. eins\n> zitat\n+ plus\n---')).toBe('1\\. eins  \n\\> zitat  \n\\+ plus  \n\\---')
    // Only real list markers are escaped, so phone numbers and amounts stay readable.
    expect(escapeBlock('+49 30 123\n1.000 €\n-5 Grad')).toBe('+49 30 123  \n1.000 €  \n-5 Grad')
  })
})

describe('exportFileName', () => {
  it('slugifies titles', () => {
    expect(exportFileName({ title: 'Fragebögen für Bäckerei Größe' })).toBe('frageboegen-fuer-baeckerei-groesse.md')
    expect(exportFileName({ title: '!!!' })).toBe('form.md')
  })
})
