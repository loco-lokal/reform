import { formAlert, createForm, expect, fillAll, test } from './fixtures'

test.describe('public form', () => {
  test('renders every question type with labels, hints and markers', async ({ page, form }) => {
    await page.goto(form.path)
    await expect(page).toHaveTitle(/E2E project brief/)
    await expect(page.getByRole('heading', { level: 1, name: 'E2E project brief' })).toBeVisible()
    await expect(page.getByText('Tell us about your project.')).toBeVisible()
    await expect(page.getByText(/^Available until /)).toBeVisible()
    await expect(page.locator('.rf-contact-eyebrow')).toHaveText('Reform')

    await expect(page.getByLabel('Your name')).toHaveAttribute('placeholder', 'Jane Doe')
    await expect(page.getByLabel('Your name')).toHaveAttribute('required', '')
    await expect(page.locator('label[for="field-name"] .rf-required')).toHaveText('*')
    await expect(page.locator('label[for="field-phone"]')).toContainText('(optional)')
    await expect(page.getByLabel('About your project')).toHaveAccessibleDescription('A few sentences are enough.')

    await expect(page.getByLabel('Email address')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Phone number')).toHaveAttribute('type', 'tel')
    await expect(page.getByLabel('Budget in EUR')).toHaveAttribute('inputmode', 'decimal')
    await expect(page.getByLabel('Start date')).toHaveAttribute('type', 'date')
    await expect(page.getByRole('radiogroup', { name: /Team size/ }).getByRole('radio')).toHaveCount(3)
    await expect(page.getByRole('radiogroup', { name: /Team size/ })).toHaveAttribute('aria-required', 'true')
    await expect(page.getByRole('group', { name: /Goals/ })).not.toHaveAttribute('aria-required')
    await expect(page.getByRole('group', { name: /Goals/ }).getByRole('checkbox')).toHaveCount(3)
    await expect(page.getByLabel('Plan').locator('option').first()).toHaveText('Pick a plan')
    await expect(page.getByRole('radio', { name: 'Yes' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'No' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled()
  })

  test('submits valid answers and shows the thank-you page', async ({ page, form, db }) => {
    await page.goto(form.path)
    await fillAll(page)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)
    await expect(page.getByRole('heading', { name: 'Thank you for your answers!' })).toBeVisible()
    await expect(page.getByText('E2E project brief')).toBeVisible()

    const { rows } = await db.query('SELECT answers FROM responses WHERE form_id = $1', [form.id])
    expect(rows).toHaveLength(1)
    expect(rows[0].answers).toEqual({
      name: 'Jane Doe',
      about: 'A new website.\nWith a booking calendar.',
      email: 'jane@example.com',
      phone: '+49 30 1234567',
      budget: '4500,50',
      start: '2027-03-01',
      size: '2-10',
      goals: ['Leads', 'Shop'],
      plan: 'Pro',
      domain: 'yes',
    })
  })

  test('leaves empty optional answers out', async ({ page, form, db }) => {
    await page.goto(form.path)
    await page.getByLabel('Your name').fill('Jane')
    await page.getByLabel('Email address').fill('jane@example.com')
    await page.getByRole('radio', { name: 'Just me' }).check({ force: true })
    await page.getByRole('radio', { name: 'No' }).check({ force: true })
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)
    const { rows } = await db.query('SELECT answers FROM responses WHERE form_id = $1', [form.id])
    expect(rows[0].answers).toEqual({ name: 'Jane', email: 'jane@example.com', size: 'Just me', domain: 'no' })
  })

  test('speaks German for a German form', async ({ page, request }) => {
    const form = await createForm(request, { language: 'de', title: 'Projektfragebogen' })
    await page.goto(form.path)
    await expect(page.locator('.rf-page')).toHaveAttribute('lang', 'de')
    await expect(page.getByText(/^Verfügbar bis /)).toBeVisible()
    await expect(page.getByLabel('Plan').locator('option').first()).toHaveText('Pick a plan')
    await expect(page.getByRole('radio', { name: 'Ja' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Nein' })).toBeVisible()

    await page.getByRole('button', { name: 'Absenden' }).click()
    await expect(formAlert(page)).toHaveText('Bitte prüfe die markierten Felder.')
    await expect(page.getByText('Bitte fülle dieses Feld aus.').first()).toBeVisible()

    await fillAll(page, { yes: 'Ja' })
    await page.getByRole('button', { name: 'Absenden' }).click()
    await expect(page.getByRole('heading', { name: 'Danke für deine Antworten!' })).toBeVisible()
  })

  test('shows the dropdown fallback placeholder', async ({ page, request }) => {
    const form = await createForm(request, { questions: [{ type: 'dropdown', label: 'Colour', options: ['Red', 'Blue'] }] })
    await page.goto(form.path)
    await expect(page.getByLabel('Colour').locator('option').first()).toHaveText('Please choose')
  })

  test('returns 404 for an unknown link', async ({ page }) => {
    const response = await page.goto('/f/this-token-does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    expect((await page.goto('/f/this-token-does-not-exist/thanks'))?.status()).toBe(404)
  })
})
