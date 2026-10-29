import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { createForm, expect, fillAll, test, type CreatedForm } from './fixtures'

const unique = (title: string) => `${title} ${randomUUID().slice(0, 8)}`

async function respond(page: Page, form: CreatedForm, fill: (page: Page) => Promise<void> = fillAll) {
  await page.goto(form.path)
  await fill(page)
  await page.getByRole('button', { name: /Submit|Absenden/ }).click()
  await expect(page).toHaveURL(`${form.path}/thanks`)
}

/** The <dd> answer to a question in a response article. */
function answer(response: ReturnType<Page['locator']>, label: string) {
  return response.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]')
}

test.describe('admin forms list', () => {
  test('lists forms newest first with lifetime, status and responses', async ({ adminPage: page, request, db }) => {
    const single = await createForm(request, { title: unique('Single'), reference: '', lifetime: { singleUse: true } })
    const both = await createForm(request, {
      title: unique('Both'),
      reference: 'deal-42',
      lifetime: { singleUse: true, expiresAt: '2099-01-02T10:30:00Z' },
    })
    const expired = await createForm(request, { title: unique('Expired') })
    await db.expireForm(expired.id)
    await respond(page, single)

    await page.goto('/admin')
    await expect(page).toHaveTitle('Forms – Reform')
    await expect(page.getByText(/^\d+ forms, newest first\.$/)).toBeVisible()

    const titles = await page.locator('tbody tr td:first-child').allInnerTexts()
    expect(titles.indexOf(expired.title)).toBeLessThan(titles.indexOf(both.title))
    expect(titles.indexOf(both.title)).toBeLessThan(titles.indexOf(single.title))

    const row = (form: CreatedForm) => page.getByRole('row').filter({ has: page.getByRole('link', { name: form.title }) })
    await expect(row(single).getByRole('cell')).toHaveText([single.title, '–', /\d{4}/, 'after 1st response', 'completed', '1'])
    await expect(row(both).getByRole('cell')).toHaveText([both.title, 'deal-42', /\d{4}/, 'after 1st response or 2 Jan 2099, 10:30', 'open', '0'])
    await expect(row(expired).locator('[data-status]')).toHaveText('expired')

    await row(both).getByRole('link').click()
    await expect(page).toHaveURL(`/admin/forms/${both.id}`)
    await page.getByRole('link', { name: '← All forms' }).click()
    await expect(page).toHaveURL('/admin')
  })
})

test.describe('admin form detail', () => {
  test('shows meta data and an empty state', async ({ adminPage: page, form }) => {
    await page.goto(`/admin/forms/${form.id}`)
    await expect(page).toHaveTitle('Responses – Reform')
    await expect(page.getByRole('heading', { level: 1, name: form.title })).toBeVisible()
    await expect(page.locator('.rf-meta [data-status]')).toHaveText('open')
    await expect(page.locator('.rf-meta')).toContainText('Reference crm-e2e')
    await expect(page.locator('.rf-meta')).toContainText('EN')
    await expect(page.locator('.rf-meta')).toContainText('0 responses')
    await expect(page.getByRole('link', { name: form.url })).toHaveAttribute('href', form.url)
    await expect(page.getByText('No responses yet.', { exact: true })).toBeVisible()
    await expect(page.locator('pre.rf-markdown')).toContainText('_No responses yet._')
  })

  test('shows every response with formatted answers', async ({ adminPage: page, form }) => {
    await respond(page, form)
    await respond(page, form, async (p) => {
      await p.getByLabel('Your name').fill('Max')
      await p.getByLabel('Email address').fill('max@example.com')
      await p.getByRole('radio', { name: 'Just me' }).check({ force: true })
      await p.getByRole('radio', { name: 'No' }).check({ force: true })
    })

    await page.goto(`/admin/forms/${form.id}`)
    await expect(page.locator('.rf-meta')).toContainText('2 responses')
    const responses = page.locator('article.rf-response')
    await expect(responses).toHaveCount(2)
    await expect(responses.nth(0).getByRole('heading')).toHaveText(/^Response 1 · /)

    const first = responses.nth(0)
    await expect(answer(first, 'Your name')).toHaveText('Jane Doe')
    await expect(answer(first, 'Start date')).toHaveText('1 Mar 2027')
    await expect(answer(first, 'Goals').getByRole('listitem')).toHaveText(['Leads', 'Shop'])
    await expect(answer(first, 'Do you own a domain?')).toHaveText('Yes')

    const second = responses.nth(1)
    await expect(answer(second, 'Phone number')).toHaveText('no answer')
    await expect(answer(second, 'Goals')).toHaveText('no answer')
    await expect(answer(second, 'Do you own a domain?')).toHaveText('No')
  })

  test('shows yes/no answers in the form language', async ({ adminPage: page, request }) => {
    const form = await createForm(request, { language: 'de', questions: [{ type: 'yes_no', label: 'Newsletter?', required: true }] })
    await respond(page, form, (p) => p.getByRole('radio', { name: 'Ja' }).check({ force: true }))
    await page.goto(`/admin/forms/${form.id}`)
    await expect(page.locator('.rf-meta')).toContainText('DE')
    await expect(answer(page.locator('article.rf-response'), 'Newsletter?')).toHaveText('Ja')
    await expect(page.locator('pre.rf-markdown')).toContainText('## Antwort — ')
  })

  test('returns 404 for unknown forms', async ({ adminPage: page }) => {
    expect((await page.goto(`/admin/forms/${randomUUID()}`))?.status()).toBe(404)
    expect((await page.goto('/admin/forms/not-a-uuid'))?.status()).toBe(404)
  })
})

test.describe('Markdown export', () => {
  test('escapes user input so it cannot add structure', async ({ adminPage: page, request }) => {
    const form = await createForm(request, {
      title: unique('Escape #1'),
      questions: [
        { id: 'name', type: 'short_text', label: 'Name' },
        { id: 'notes', type: 'long_text', label: 'Notes' },
      ],
    })
    await respond(page, form, async (p) => {
      await p.getByLabel('Name').fill('# Boss *bold*')
      await p.getByLabel('Notes').fill('- not a list\n1. not numbered')
    })
    await page.goto(`/admin/forms/${form.id}`)
    const markdown = await page.locator('pre.rf-markdown').innerText()
    expect(markdown).toContain(`# ${form.title.replace('#', '\\#')}`)
    expect(markdown).toContain('- Reference: crm-e2e')
    expect(markdown).toContain('- Responses: 1')
    expect(markdown).toMatch(/## Response — /)
    expect(markdown).toContain('### Name\n\n\\# Boss \\*bold\\*')
    expect(markdown).toContain('\\- not a list  \n1\\. not numbered')
  })

  test('copies the Markdown to the clipboard', async ({ adminPage: page, context, form, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/admin/forms/${form.id}`)
    await page.getByRole('button', { name: 'Copy Markdown' }).click()
    await expect(page.getByRole('button', { name: 'Copied ✓' })).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied.trim()).toBe((await page.locator('pre.rf-markdown').innerText()).trim())
    await expect(page.getByRole('button', { name: 'Copy Markdown' })).toBeVisible({ timeout: 4000 })
  })

  test('downloads the Markdown as a file', async ({ adminPage: page, request }) => {
    const form = await createForm(request, { title: 'Kundenumfrage Größe & Wünsche' })
    await respond(page, form)
    await page.goto(`/admin/forms/${form.id}`)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download as .md' }).click()])
    expect(download.suggestedFilename()).toBe('kundenumfrage-groesse-wuensche.md')
    const content = await readFile(await download.path(), 'utf8')
    expect(content.trim()).toBe((await page.locator('pre.rf-markdown').innerText()).trim())

    const response = await page.request.get(`/admin/forms/${form.id}/export`)
    expect(response.headers()['content-type']).toBe('text/markdown; charset=utf-8')
    expect(response.headers()['cache-control']).toBe('no-store')
    expect((await page.request.get(`/admin/forms/${randomUUID()}/export`)).status()).toBe(404)
  })
})
