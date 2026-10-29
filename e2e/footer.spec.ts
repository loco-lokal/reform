import { E2E_ENV } from './env'
import { createForm, expect, test } from './fixtures'

test('legal links from the environment appear in the footer, in the form language', async ({ page, request, form }) => {
  await page.goto(form.path)
  const footer = page.locator('footer')
  await expect(footer.getByRole('link', { name: 'Imprint' })).toHaveAttribute('href', E2E_ENV.REFORM_IMPRINT_URL)
  await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', E2E_ENV.REFORM_PRIVACY_URL)

  const german = await createForm(request, { language: 'de' })
  await page.goto(german.path)
  await expect(footer.getByRole('link', { name: 'Impressum' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Datenschutz' })).toBeVisible()

  await page.goto('/admin/login')
  await expect(footer.getByRole('link', { name: 'Imprint' })).toBeVisible()
})
