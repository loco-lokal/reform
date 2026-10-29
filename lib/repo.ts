import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { parseStoredBranding, type AssetKind, type BrandingSettings } from './branding'
import { pool } from './db'
import { newToken, type Answers, type Form, type FormResponse, type Language, type NewForm, type Question } from './forms'

type FormRow = {
  id: string
  token: string
  title: string
  description: string
  language: Language
  questions: Question[]
  single_use: boolean
  expires_at: Date | null
  closed_at: Date | null
  reference: string
  created_at: Date
}

const FORM_COLUMNS = 'id, token, title, description, language, questions, single_use, expires_at, closed_at, reference, created_at'

function toForm(row: FormRow): Form {
  return {
    id: row.id,
    token: row.token,
    title: row.title,
    description: row.description,
    language: row.language,
    questions: row.questions,
    singleUse: row.single_use,
    expiresAt: row.expires_at,
    closedAt: row.closed_at,
    reference: row.reference,
    createdAt: row.created_at,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function createForm(form: NewForm): Promise<Form> {
  const { rows } = await pool().query<FormRow>(
    `INSERT INTO forms (id, token, title, description, language, questions, single_use, expires_at, reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${FORM_COLUMNS}`,
    [
      randomUUID(),
      newToken(),
      form.title,
      form.description,
      form.language,
      JSON.stringify(form.questions),
      form.singleUse,
      form.expiresAt,
      form.reference,
    ],
  )
  return toForm(rows[0])
}

export async function getFormByToken(token: string): Promise<Form | null> {
  const { rows } = await pool().query<FormRow>(`SELECT ${FORM_COLUMNS} FROM forms WHERE token = $1`, [token])
  return rows[0] ? toForm(rows[0]) : null
}

export async function getForm(id: string): Promise<Form | null> {
  if (!UUID.test(id)) return null
  const { rows } = await pool().query<FormRow>(`SELECT ${FORM_COLUMNS} FROM forms WHERE id = $1`, [id])
  return rows[0] ? toForm(rows[0]) : null
}

export type FormSummary = Form & { responseCount: number }

export async function listForms(limit = 500): Promise<FormSummary[]> {
  const { rows } = await pool().query<FormRow & { response_count: number }>(
    `SELECT ${FORM_COLUMNS.split(', ').map((c) => `f.${c}`).join(', ')},
            (SELECT count(*)::int FROM responses r WHERE r.form_id = f.id) AS response_count
     FROM forms f ORDER BY f.created_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map((row) => ({ ...toForm(row), responseCount: row.response_count }))
}

export async function listResponses(formId: string): Promise<FormResponse[]> {
  const { rows } = await pool().query<{ id: string; form_id: string; answers: Answers; submitted_at: Date }>(
    'SELECT id, form_id, answers, submitted_at FROM responses WHERE form_id = $1 ORDER BY submitted_at, id',
    [formId],
  )
  return rows.map((row) => ({ id: row.id, formId: row.form_id, answers: row.answers, submittedAt: row.submitted_at }))
}

export type SubmitResult = 'ok' | 'not_found' | 'unavailable'

/**
 * Stores a response. The form row is locked for the transaction, so a single-use form
 * accepts exactly one response even when two are submitted at the same time.
 */
export async function submitResponse(token: string, answers: Answers): Promise<SubmitResult> {
  return transaction(async (client) => {
    const { rows } = await client.query<Pick<FormRow, 'id' | 'single_use' | 'expires_at' | 'closed_at'>>(
      'SELECT id, single_use, expires_at, closed_at FROM forms WHERE token = $1 FOR UPDATE',
      [token],
    )
    const form = rows[0]
    if (!form) return 'not_found'
    if (form.closed_at || (form.expires_at && form.expires_at <= new Date())) return 'unavailable'
    await client.query('INSERT INTO responses (id, form_id, answers) VALUES ($1, $2, $3)', [
      randomUUID(),
      form.id,
      JSON.stringify(answers),
    ])
    if (form.single_use) await client.query('UPDATE forms SET closed_at = now() WHERE id = $1', [form.id])
    return 'ok'
  })
}

export type BrandingAsset = { contentType: string; data: Buffer; updatedAt: Date }

/** Saved settings (defaults when nothing was saved) and the upload time of each stored image. */
export async function getBranding(): Promise<{ settings: BrandingSettings; assets: Partial<Record<AssetKind, Date>> }> {
  const [settings, assets] = await Promise.all([
    pool().query<{ settings: unknown }>('SELECT settings FROM branding'),
    pool().query<{ kind: AssetKind; updated_at: Date }>('SELECT kind, updated_at FROM branding_assets'),
  ])
  return {
    settings: parseStoredBranding(settings.rows[0]?.settings),
    assets: Object.fromEntries(assets.rows.map((row) => [row.kind, row.updated_at])),
  }
}

export async function getBrandingAsset(kind: AssetKind): Promise<BrandingAsset | null> {
  const { rows } = await pool().query<{ content_type: string; data: Buffer; updated_at: Date }>(
    'SELECT content_type, data, updated_at FROM branding_assets WHERE kind = $1',
    [kind],
  )
  return rows[0] ? { contentType: rows[0].content_type, data: rows[0].data, updatedAt: rows[0].updated_at } : null
}

/** Saves settings and images together. An image left undefined is kept, null removes it. */
export async function saveBranding(
  settings: BrandingSettings,
  assets: Partial<Record<AssetKind, { contentType: string; data: Uint8Array } | null>> = {},
): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO branding (id, settings) VALUES (true, $1)
       ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`,
      [JSON.stringify(settings)],
    )
    for (const [kind, asset] of Object.entries(assets)) {
      if (asset === undefined) continue
      if (asset === null) {
        await client.query('DELETE FROM branding_assets WHERE kind = $1', [kind])
        continue
      }
      await client.query(
        `INSERT INTO branding_assets (kind, content_type, data) VALUES ($1, $2, $3)
         ON CONFLICT (kind) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = now()`,
        [kind, asset.contentType, Buffer.from(asset.data)],
      )
    }
  })
}

/** Back to the built-in branding: removes saved settings and images. */
export async function resetBranding(): Promise<void> {
  await transaction(async (client) => {
    await client.query('DELETE FROM branding')
    await client.query('DELETE FROM branding_assets')
  })
}

async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
