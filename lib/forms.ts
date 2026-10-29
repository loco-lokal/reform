import { randomBytes } from 'node:crypto'
import { z } from 'zod'

export const LANGUAGES = ['de', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const QUESTION_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'number',
  'date',
  'single_choice',
  'multiple_choice',
  'dropdown',
  'yes_no',
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

const CHOICE_TYPES: readonly QuestionType[] = ['single_choice', 'multiple_choice', 'dropdown']

export function hasOptions(type: QuestionType): boolean {
  return CHOICE_TYPES.includes(type)
}

export type Question = {
  id: string
  type: QuestionType
  label: string
  help?: string
  placeholder?: string
  required: boolean
  options?: string[]
}

export type Form = {
  id: string
  token: string
  title: string
  description: string
  language: Language
  questions: Question[]
  singleUse: boolean
  expiresAt: Date | null
  closedAt: Date | null
  reference: string
  createdAt: Date
}

export type FormStatus = 'open' | 'closed' | 'expired'

export function formStatus(form: Pick<Form, 'closedAt' | 'expiresAt'>, now = new Date()): FormStatus {
  if (form.closedAt) return 'closed'
  if (form.expiresAt && form.expiresAt <= now) return 'expired'
  return 'open'
}

/** Answer per question id: a string, or the selected options of a multiple choice question. */
export type Answers = Record<string, string | string[]>

export type FormResponse = {
  id: string
  formId: string
  answers: Answers
  submittedAt: Date
}

const MAX_OPTIONS = 50

const questionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, { error: 'must be 1-64 characters of a-z, 0-9, _ and -' })
      .optional(),
    type: z.enum(QUESTION_TYPES),
    label: z.string().trim().min(1).max(500),
    help: z.string().trim().max(1000).optional(),
    placeholder: z.string().trim().max(200).optional(),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(200)).optional(),
  })
  .superRefine((q, ctx) => {
    if (!hasOptions(q.type)) {
      if (q.options !== undefined) ctx.addIssue({ code: 'custom', path: ['options'], message: `not allowed for type ${q.type}` })
      return
    }
    const options = q.options ?? []
    if (options.length < 2 || options.length > MAX_OPTIONS) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `type ${q.type} needs 2-${MAX_OPTIONS} options` })
    } else if (new Set(options).size !== options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be unique' })
    }
  })

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  language: z.enum(LANGUAGES).default('en'),
  reference: z.string().trim().max(256).default(''),
  lifetime: z.object({
    singleUse: z.boolean().default(false),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  }),
  questions: z.array(questionSchema).min(1).max(100),
})

export type NewForm = Omit<Form, 'id' | 'token' | 'closedAt' | 'createdAt'>

export type Issue = { path: string; message: string }

export type ParseResult = { ok: true; form: NewForm } | { ok: false; issues: Issue[] }

/** Validates a create request from the API and fills in defaults and missing question ids. */
export function parseCreateRequest(body: unknown, now = new Date()): ParseResult {
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })) }
  }
  const req = parsed.data
  const issues: Issue[] = []

  const expiresAt = req.lifetime.expiresAt ? new Date(req.lifetime.expiresAt) : null
  if (!req.lifetime.singleUse && !expiresAt) {
    issues.push({ path: 'lifetime', message: 'set singleUse to true and/or an expiresAt date' })
  }
  if (expiresAt && expiresAt <= now) {
    issues.push({ path: 'lifetime.expiresAt', message: 'must be in the future' })
  }

  const taken = new Set(req.questions.flatMap((q) => (q.id ? [q.id] : [])))
  const seen = new Set<string>()
  let next = 1
  const questions: Question[] = req.questions.map((q, index) => {
    let id = q.id
    if (id) {
      if (seen.has(id)) issues.push({ path: `questions[${index}].id`, message: `duplicate id "${id}"` })
    } else {
      while (taken.has(`q${next}`)) next++
      id = `q${next++}`
    }
    seen.add(id)
    return {
      id,
      type: q.type,
      label: q.label,
      ...(q.help ? { help: q.help } : {}),
      ...(q.placeholder ? { placeholder: q.placeholder } : {}),
      required: q.required,
      ...(q.options ? { options: q.options } : {}),
    }
  })

  if (issues.length) return { ok: false, issues }
  return {
    ok: true,
    form: {
      title: req.title,
      description: req.description,
      language: req.language,
      reference: req.reference,
      questions,
      singleUse: req.lifetime.singleUse,
      expiresAt,
    },
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key)), '')
}

/** Unguessable public link token. */
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}
