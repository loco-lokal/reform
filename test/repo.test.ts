import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Runs against a real database only when REFORM_TEST_DATABASE_URL is set (the schema is migrated, tables are truncated).
const url = process.env.REFORM_TEST_DATABASE_URL

describe.skipIf(!url)('repo', async () => {
  process.env.REFORM_DATABASE_URL = url
  process.env.REFORM_API_SECRET = 'test'
  process.env.REFORM_ADMIN_PASSWORD = 'test'
  process.env.REFORM_SESSION_SECRET = 'x'.repeat(32)
  process.env.REFORM_PUBLIC_URL = 'http://localhost'
  const { pool } = await import('@/lib/db')
  const { migrate } = await import('@/lib/migrate')
  const repo = await import('@/lib/repo')

  const questions = [{ id: 'name', type: 'short_text' as const, label: 'Name', required: true }]
  const newForm = { title: 'T', description: '', language: 'de' as const, reference: 'ref', questions, singleUse: false, expiresAt: null }

  beforeAll(async () => {
    await migrate()
    await migrate() // idempotent
    await pool().query('TRUNCATE forms, branding, branding_assets CASCADE')
  })
  afterAll(async () => {
    await pool().end()
  })

  it('creates and reads forms', async () => {
    const form = await repo.createForm(newForm)
    expect(form.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await repo.getFormByToken(form.token)).toEqual(form)
    expect(await repo.getForm(form.id)).toEqual(form)
    expect(await repo.getForm('not-a-uuid')).toBeNull()
  })

  it('closes single-use forms after exactly one of several concurrent submits', async () => {
    const form = await repo.createForm({ ...newForm, singleUse: true })
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => repo.submitResponse(form.token, { name: `n${i}` })))
    expect(results.filter((r) => r === 'ok')).toHaveLength(1)
    expect(results.filter((r) => r === 'unavailable')).toHaveLength(4)
    expect((await repo.getForm(form.id))?.closedAt).toBeInstanceOf(Date)
    expect(await repo.listResponses(form.id)).toHaveLength(1)
  })

  it('accepts many responses until the expiry date', async () => {
    const open = await repo.createForm({ ...newForm, expiresAt: new Date(Date.now() + 60_000) })
    expect(await repo.submitResponse(open.token, { name: 'a' })).toBe('ok')
    expect(await repo.submitResponse(open.token, { name: 'b' })).toBe('ok')
    const expired = await repo.createForm({ ...newForm, expiresAt: new Date(Date.now() - 1000) })
    expect(await repo.submitResponse(expired.token, { name: 'a' })).toBe('unavailable')
    expect(await repo.submitResponse('missing', { name: 'a' })).toBe('not_found')
    const summary = (await repo.listForms()).find((f) => f.id === open.id)
    expect(summary?.responseCount).toBe(2)
  })

  it('saves, reads and resets branding', async () => {
    const { DEFAULT_BRANDING } = await import('@/lib/branding')
    expect(await repo.getBranding()).toEqual({ settings: DEFAULT_BRANDING, assets: {} })

    const settings = { ...DEFAULT_BRANDING, name: 'Acme', siteUrl: 'https://acme.example' }
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    await repo.saveBranding(settings, { logo: { contentType: 'image/png', data: png } })
    const saved = await repo.getBranding()
    expect(saved.settings).toEqual(settings)
    expect(saved.assets.logo).toBeInstanceOf(Date)
    expect(saved.assets.icon).toBeUndefined()
    const logo = await repo.getBrandingAsset('logo')
    expect(logo?.contentType).toBe('image/png')
    expect(new Uint8Array(logo!.data)).toEqual(png)

    // Undefined keeps an image, null removes it.
    await repo.saveBranding({ ...settings, name: 'Acme 2' })
    expect(await repo.getBrandingAsset('logo')).not.toBeNull()
    await repo.saveBranding(settings, { logo: null })
    expect(await repo.getBrandingAsset('logo')).toBeNull()

    await repo.saveBranding(settings, { icon: { contentType: 'image/png', data: png } })
    await repo.resetBranding()
    expect(await repo.getBranding()).toEqual({ settings: DEFAULT_BRANDING, assets: {} })
  })
})
