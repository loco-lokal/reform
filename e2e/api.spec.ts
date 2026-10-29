import { E2E_ENV } from './env'
import { expect, formBody, test } from './fixtures'

const headers = { 'x-api-key': E2E_ENV.REFORM_API_SECRET }

test.describe('POST /api/forms', () => {
  test('creates a form and returns its public link', async ({ request }) => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const response = await request.post('/api/forms', { headers, data: formBody({ lifetime: { singleUse: true, expiresAt: expiresAt.toISOString() } }) })
    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.url).toMatch(new RegExp(`^${E2E_ENV.REFORM_PUBLIC_URL}/f/[A-Za-z0-9_-]{43}$`))
    expect(body.singleUse).toBe(true)
    expect(body.expiresAt).toBe(expiresAt.toISOString())
    expect((await request.get(body.url)).status()).toBe(200)
  })

  test('rejects a missing or wrong api key', async ({ request }) => {
    for (const h of [{}, { 'x-api-key': 'wrong' }] as Record<string, string>[]) {
      const response = await request.post('/api/forms', { headers: h, data: formBody() })
      expect(response.status()).toBe(401)
      expect(await response.json()).toMatchObject({ code: 'unauthorized' })
    }
  })

  test('rejects a body that is not JSON', async ({ request }) => {
    const response = await request.post('/api/forms', { headers: { ...headers, 'content-type': 'application/json' }, data: Buffer.from('{nope') })
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'invalid_json' })
  })

  test('rejects a body over 256 KB', async ({ request }) => {
    const response = await request.post('/api/forms', { headers, data: formBody({ description: 'x'.repeat(300 * 1024) }) })
    expect(response.status()).toBe(413)
    expect(await response.json()).toMatchObject({ code: 'too_large' })
  })

  const invalid: [string, Record<string, unknown>, string][] = [
    ['no lifetime limit', { lifetime: {} }, 'lifetime'],
    ['an expiry date in the past', { lifetime: { expiresAt: '2020-01-01T00:00:00Z' } }, 'lifetime.expiresAt'],
    ['no questions', { questions: [] }, 'questions'],
    ['a missing title', { title: '' }, 'title'],
    ['an unknown language', { language: 'fr' }, 'language'],
    ['a choice question without options', { questions: [{ type: 'dropdown', label: 'Pick' }] }, 'questions[0].options'],
    ['options on a text question', { questions: [{ type: 'short_text', label: 'Name', options: ['a', 'b'] }] }, 'questions[0].options'],
    ['duplicate options', { questions: [{ type: 'single_choice', label: 'Pick', options: ['a', 'a'] }] }, 'questions[0].options'],
    ['an unknown question type', { questions: [{ type: 'rating', label: 'Stars' }] }, 'questions[0].type'],
    ['an invalid question id', { questions: [{ id: 'Bad Id', type: 'short_text', label: 'Name' }] }, 'questions[0].id'],
    [
      'duplicate question ids',
      { questions: [{ id: 'a', type: 'short_text', label: 'A' }, { id: 'a', type: 'short_text', label: 'B' }] },
      'questions[1].id',
    ],
  ]
  for (const [name, overrides, path] of invalid) {
    test(`rejects ${name}`, async ({ request }) => {
      const response = await request.post('/api/forms', { headers, data: formBody(overrides) })
      expect(response.status()).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('invalid_request')
      expect(body.issues.map((i: { path: string }) => i.path)).toContain(path)
    })
  }

  test('numbers questions without ids around the taken ones', async ({ request, adminPage }) => {
    const response = await request.post('/api/forms', {
      headers,
      data: formBody({
        title: 'Generated ids',
        lifetime: { singleUse: true },
        questions: [
          { type: 'short_text', label: 'First' },
          { id: 'q2', type: 'short_text', label: 'Second' },
          { type: 'short_text', label: 'Third' },
        ],
      }),
    })
    const { url } = await response.json()
    await adminPage.goto(url)
    await expect(adminPage.locator('[name="q_q1"]')).toBeVisible()
    await expect(adminPage.locator('[name="q_q2"]')).toHaveAttribute('id', 'field-q2')
    await expect(adminPage.getByLabel('Third')).toHaveAttribute('name', 'q_q3')
  })
})

test('GET /api/healthz reports a reachable database', async ({ request }) => {
  const response = await request.get('/api/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})

test('pages send security headers', async ({ request, form }) => {
  const response = await request.get(form.path)
  const h = response.headers()
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('same-origin')
  expect(h['x-robots-tag']).toBe('noindex, nofollow')
  expect(h['x-powered-by']).toBeUndefined()
})
