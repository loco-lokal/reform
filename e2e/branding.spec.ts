import type { Page } from '@playwright/test'
import { createForm, expect, fillAll, signIn, test } from './fixtures'

// Branding applies to every page, so this file runs serially in its own project after all other tests,
// and leaves the defaults behind.
test.describe.configure({ mode: 'serial' })

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')

test.beforeEach(async ({ context }) => signIn(context))
test.afterAll(async ({ db }) => {
  await db.query('TRUNCATE branding, branding_assets')
})

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

test('name and website apply to every page', async ({ page, request }) => {
  await page.goto('/admin/branding')
  await expect(page.getByRole('heading', { name: 'Branding' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Acme Studio')
  await page.getByLabel('Website').fill('https://acme.example/')
  await save(page)
  await expect(page.getByText('Saved.')).toBeVisible()

  const form = await createForm(request)
  await page.goto(form.path)
  await expect(page).toHaveTitle('E2E project brief – Acme Studio')
  await expect(page.locator('.rf-nav-logo')).toHaveText('Acme Studio')
  await expect(page.locator('.rf-nav-logo')).toHaveAttribute('href', 'https://acme.example')
  await expect(page.locator('.rf-contact-eyebrow')).toHaveText('Acme Studio')
  await expect(page.locator('footer')).toContainText(`© ${new Date().getFullYear()} Acme Studio`)

  await fillAll(page)
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByRole('link', { name: 'To the website' })).toHaveAttribute('href', 'https://acme.example')

  const root = await request.get('/', { maxRedirects: 0 })
  expect(root.headers()['location']).toBe('https://acme.example')
})

test('rejects an invalid website', async ({ page }) => {
  await page.goto('/admin/branding')
  await page.getByLabel('Website').fill('javascript:alert(1)')
  await save(page)
  await expect(page.getByText('Please check the highlighted fields.')).toBeVisible()
  await expect(page.getByText('Invalid value.')).toBeVisible()
})

test('the preview follows unsaved changes and saved colours and fonts reach the pages', async ({ page, request }) => {
  await page.goto('/admin/branding')
  const preview = page.locator('.rf-preview')
  await page.locator('#accent').fill('#ff5500')
  await expect(preview).toHaveCSS('--rf-accent', '#ff5500')
  await page.getByLabel('Name', { exact: true }).fill('Preview Co')
  await expect(preview.locator('.rf-preview-nav')).toHaveText('Preview Co')
  await page.getByLabel('Heading font').selectOption({ label: 'Lora' })
  await page.getByLabel('Heading weight').selectOption('600')
  await page.getByLabel(/^Base font size/).fill('18')
  await expect(page.getByText('Base font size: 18px')).toBeVisible()
  await expect(preview).toHaveCSS('font-size', '18px')

  // Nothing is applied before saving.
  const form = await createForm(request)
  const other = await page.context().newPage()
  await other.goto(form.path)
  await expect(other.locator('body')).not.toHaveCSS('--rf-accent', '#ff5500')

  await save(page)
  await expect(page.getByText('Saved.')).toBeVisible()
  await other.reload()
  const body = other.locator('body')
  await expect(body).toHaveCSS('--rf-accent', '#ff5500')
  await expect(body).toHaveCSS('--rf-font-display', /Lora/)
  await expect(body).toHaveCSS('--rf-display-weight', '600')
  await expect(other.locator('html')).toHaveCSS('font-size', '18px')
  await expect(other.locator('.rf-nav-logo')).toHaveText('Preview Co')

  // The saved values are shown when the admin comes back.
  await page.reload()
  await expect(page.locator('#accent')).toHaveValue('#ff5500')
  await expect(page.getByLabel('Heading font')).toHaveValue('lora')
})

test('rejects invalid colours and sizes sent past the browser checks', async ({ page }) => {
  await page.goto('/admin/branding')
  await page.locator('#accent').evaluate((el: HTMLInputElement) => el.removeAttribute('pattern'))
  await page.locator('#accent').fill('red')
  await page.locator('#baseSize').evaluate((el: HTMLInputElement) => {
    el.type = 'text'
    el.value = '99'
  })
  await save(page)
  await expect(page.getByText('Please check the highlighted fields.')).toBeVisible()
  await expect(page.locator('#accent')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.rf-field-error')).toHaveText(['Invalid value.', 'Invalid value.'])
})

test('uploads, serves and removes the logo and icon', async ({ page, request }) => {
  await page.goto('/admin/branding')
  await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await page.getByLabel('Icon (favicon)').setInputFiles({ name: 'icon.svg', mimeType: 'image/svg+xml', buffer: SVG })
  await save(page)
  await expect(page.getByText('Saved.')).toBeVisible()

  const logo = await request.get('/branding/logo')
  expect(logo.status()).toBe(200)
  expect(logo.headers()['content-type']).toBe('image/png')
  expect(logo.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
  expect(Buffer.compare(await logo.body(), PNG)).toBe(0)

  const icon = await request.get('/branding/icon')
  expect(icon.headers()['content-type']).toBe('image/svg+xml')
  expect(icon.headers()['content-security-policy']).toContain('sandbox')

  const form = await createForm(request)
  await page.goto(form.path)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /^\/branding\/icon\?v=\d+$/)
  await expect(page.locator('.rf-nav-logo img')).toHaveAttribute('src', /^\/branding\/logo\?v=\d+$/)

  await page.goto('/admin/branding')
  await page.locator('input[name="logoRemove"]').check()
  await save(page)
  await expect(page.getByText('Saved.')).toBeVisible()
  expect((await request.get('/branding/logo')).status()).toBe(404)
  expect((await request.get('/branding/icon')).status()).toBe(200)
  expect((await request.get('/branding/banner')).status()).toBe(404)
})

test('rejects files that are not images or too large', async ({ page, request }) => {
  await page.goto('/admin/branding')
  await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await page.getByLabel('Icon (favicon)').setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([PNG, Buffer.alloc(600 * 1024)]),
  })
  await save(page)
  await expect(page.getByText('Please upload a PNG, JPEG, WebP, SVG or ICO file.')).toBeVisible()
  await expect(page.getByText('The file is larger than 512 KB.')).toBeVisible()
  expect((await request.get('/branding/logo')).status()).toBe(404)
})

test('resets everything to the defaults', async ({ page, request }) => {
  await page.goto('/admin/branding')
  await page.getByLabel('Name', { exact: true }).fill('Temporary')
  await save(page)
  await expect(page.getByText('Saved.')).toBeVisible()

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Reset all branding settings and images to the defaults?')
    void dialog.accept()
  })
  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Reform')
  await expect(page.getByLabel('Website')).toHaveValue('')

  const form = await createForm(request)
  await page.goto(form.path)
  await expect(page.locator('.rf-nav-logo')).toHaveText('Reform')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  expect((await request.get('/branding/icon')).status()).toBe(404)
  expect((await request.get('/', { maxRedirects: 0 })).headers()['location']).toBe('/admin')
})

test('dismissing the reset dialog keeps the branding', async ({ page }) => {
  await page.goto('/admin/branding')
  await page.getByLabel('Name', { exact: true }).fill('Keep Me')
  await save(page)
  await expect(page.getByText('Saved.')).toBeVisible()
  page.once('dialog', (dialog) => void dialog.dismiss())
  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await page.reload()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Keep Me')
})
