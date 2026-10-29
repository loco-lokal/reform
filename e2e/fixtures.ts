import { randomInt } from 'node:crypto'
import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { Pool } from 'pg'
import { SESSION_COOKIE, createSession } from '../lib/session'
import { BASE_URL, E2E_ENV } from './env'

export { expect }

export type CreatedForm = {
  id: string
  title: string
  url: string
  token: string
  path: string
  expiresAt: string | null
  singleUse: boolean
}

/** One question of every type, so a single form covers the whole renderer and validator. */
export const ALL_TYPES = [
  { id: 'name', type: 'short_text', label: 'Your name', required: true, placeholder: 'Jane Doe' },
  { id: 'about', type: 'long_text', label: 'About your project', help: 'A few sentences are enough.' },
  { id: 'email', type: 'email', label: 'Email address', required: true },
  { id: 'phone', type: 'phone', label: 'Phone number' },
  { id: 'budget', type: 'number', label: 'Budget in EUR' },
  { id: 'start', type: 'date', label: 'Start date' },
  { id: 'size', type: 'single_choice', label: 'Team size', options: ['Just me', '2-10', 'More than 10'], required: true },
  { id: 'goals', type: 'multiple_choice', label: 'Goals', options: ['Leads', 'Bookings', 'Shop'] },
  { id: 'plan', type: 'dropdown', label: 'Plan', options: ['Basic', 'Pro'], placeholder: 'Pick a plan' },
  { id: 'domain', type: 'yes_no', label: 'Do you own a domain?', required: true },
] as const

export type FormBody = Record<string, unknown>

export function formBody(overrides: FormBody = {}): FormBody {
  return {
    title: 'E2E project brief',
    description: 'Tell us about your project.\nIt takes two minutes.',
    reference: 'crm-e2e',
    lifetime: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
    questions: ALL_TYPES,
    ...overrides,
  }
}

export async function createForm(request: APIRequestContext, overrides: FormBody = {}): Promise<CreatedForm> {
  const data = formBody(overrides)
  const response = await request.post('/api/forms', { headers: { 'x-api-key': E2E_ENV.REFORM_API_SECRET }, data })
  expect(response.status(), await response.text()).toBe(201)
  const body = await response.json()
  const token = body.url.split('/f/')[1]
  return { ...body, title: data.title, token, path: `/f/${token}` }
}

/** Fills the ALL_TYPES form with valid answers. */
export async function fillAll(page: Page, { yes = 'Yes' } = {}) {
  await page.getByLabel('Your name').fill('Jane Doe')
  await page.getByLabel('About your project').fill('A new website.\nWith a booking calendar.')
  await page.getByLabel('Email address').fill('jane@example.com')
  await page.getByLabel('Phone number').fill('+49 30 1234567')
  await page.getByLabel('Budget in EUR').fill('4500,50')
  await page.getByLabel('Start date').fill('2027-03-01')
  await page.getByRole('radio', { name: '2-10' }).check({ force: true })
  await page.getByRole('checkbox', { name: 'Leads' }).check({ force: true })
  await page.getByRole('checkbox', { name: 'Shop' }).check({ force: true })
  await page.getByLabel('Plan').selectOption('Pro')
  await page.getByRole('radiogroup', { name: /Do you own a domain/ }).getByRole('radio', { name: yes }).check({ force: true })
}

/** The form's error summary (Next.js renders its own, empty role=alert route announcer as well). */
export function formAlert(page: Page) {
  return page.locator('.rf-contact-status[role="alert"]')
}

/** Clicks a submit button and waits for the Server Action's response, even when the page looks the same afterwards. */
export async function submit(page: Page, name: string | RegExp = 'Submit') {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().startsWith(BASE_URL)),
    page.getByRole('button', { name }).click(),
  ])
}

/** A random client IP, sent as X-Forwarded-For, so per-IP rate limits do not leak between tests. */
export function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`
}

export async function signIn(context: BrowserContext) {
  await context.addCookies([
    { name: SESSION_COOKIE, value: await createSession(E2E_ENV.REFORM_SESSION_SECRET), url: BASE_URL, httpOnly: true, sameSite: 'Strict' },
  ])
}

type Db = {
  query: Pool['query']
  expireForm(id: string): Promise<void>
  closeForm(id: string): Promise<void>
  responseCount(id: string): Promise<number>
}

let pool: Pool | undefined

export const test = base.extend<{ ip: string; adminPage: Page; form: CreatedForm }, { db: Db }>({
  // Every test gets its own client IP for the rate limiters.
  ip: async ({}, use) => use(randomIp()),
  extraHTTPHeaders: async ({ ip }, use) => use({ 'x-forwarded-for': ip }),

  // A page with a valid admin session cookie, minted like the login action does.
  adminPage: async ({ page, context }, use) => {
    await signIn(context)
    await use(page)
  },

  form: async ({ request }, use) => use(await createForm(request)),

  db: [
    async ({}, use) => {
      pool ??= new Pool({ connectionString: E2E_ENV.REFORM_DATABASE_URL, max: 2 })
      await use({
        query: pool.query.bind(pool) as Pool['query'],
        async expireForm(id) {
          await pool!.query(`UPDATE forms SET expires_at = now() - interval '1 minute' WHERE id = $1`, [id])
        },
        async closeForm(id) {
          await pool!.query('UPDATE forms SET closed_at = now() WHERE id = $1', [id])
        },
        async responseCount(id) {
          const { rows } = await pool!.query('SELECT count(*)::int AS n FROM responses WHERE form_id = $1', [id])
          return rows[0].n
        },
      })
      await pool.end()
      pool = undefined
    },
    { scope: 'worker' },
  ],
})
