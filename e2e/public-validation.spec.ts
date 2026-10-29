import { formAlert, createForm, expect, fillAll, test } from './fixtures'

test.describe('public form validation', () => {
  test('marks every missing required answer and focuses the first', async ({ page, form, db }) => {
    await page.goto(form.path)
    await page.getByRole('button', { name: 'Submit' }).click()

    await expect(formAlert(page)).toHaveText('Please check the highlighted fields.')
    for (const label of ['Your name', 'Email address']) {
      await expect(page.getByLabel(label)).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByLabel(label)).toHaveAccessibleDescription('Please fill in this field.')
    }
    await expect(page.getByRole('radiogroup', { name: /Team size/ })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('radiogroup', { name: /Do you own a domain/ })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('.rf-field-error')).toHaveCount(4)
    await expect(page.getByLabel('Phone number')).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Your name')).toBeFocused()
    expect(await db.responseCount(form.id)).toBe(0)
  })

  test('explains invalid formats and keeps what was typed', async ({ page, form }) => {
    await page.goto(form.path)
    await fillAll(page)
    await page.getByLabel('Email address').fill('jane@example')
    await page.getByLabel('Phone number').fill('123')
    await page.getByLabel('Budget in EUR').fill('a lot')
    await page.getByRole('button', { name: 'Submit' }).click()

    await expect(formAlert(page)).toBeVisible()
    await expect(page.getByLabel('Email address')).toHaveAccessibleDescription('Please enter a valid email address.')
    await expect(page.getByLabel('Phone number')).toHaveAccessibleDescription('Please enter a valid phone number.')
    await expect(page.getByLabel('Budget in EUR')).toHaveAccessibleDescription('Please enter a number.')
    await expect(page.getByLabel('Email address')).toBeFocused()

    // The form remounts with the submitted values.
    await expect(page.getByLabel('Your name')).toHaveValue('Jane Doe')
    await expect(page.getByLabel('About your project')).toHaveValue('A new website.\nWith a booking calendar.')
    await expect(page.getByLabel('Email address')).toHaveValue('jane@example')
    await expect(page.getByLabel('Start date')).toHaveValue('2027-03-01')
    await expect(page.getByRole('radio', { name: '2-10' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Leads' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Bookings' })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Shop' })).toBeChecked()
    await expect(page.getByLabel('Plan')).toHaveValue('Pro')
    await expect(page.getByRole('radio', { name: 'Yes' })).toBeChecked()

    await page.getByLabel('Email address').fill('jane@example.com')
    await page.getByLabel('Phone number').fill('+49 (30) 123-4567')
    await page.getByLabel('Budget in EUR').fill('-12.5')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)
  })

  test('rejects an impossible date', async ({ page, form }) => {
    await page.goto(form.path)
    await fillAll(page)
    // A date input cannot hold 2027-02-30; send it the way a script or old browser could.
    await page.getByLabel('Start date').evaluate((el: HTMLInputElement) => {
      el.type = 'text'
      el.value = '2027-02-30'
    })
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByLabel('Start date')).toHaveAccessibleDescription('Please enter a valid date.')
  })

  test('rejects answers that are not among the options', async ({ page, form, db }) => {
    await page.goto(form.path)
    await fillAll(page)
    await page.getByRole('radio', { name: '2-10' }).evaluate((el: HTMLInputElement) => (el.value = 'Hacked'))
    await page.getByLabel('Plan').evaluate((el: HTMLSelectElement) => (el.options[2].value = 'Enterprise'))
    await page.getByRole('checkbox', { name: 'Leads' }).evaluate((el: HTMLInputElement) => (el.value = 'Free stuff'))
    await page.getByRole('button', { name: 'Submit' }).click()

    const message = 'Please choose one of the given answers.'
    await expect(page.getByRole('radiogroup', { name: /Team size/ })).toHaveAccessibleDescription(message)
    await expect(page.getByRole('group', { name: /Goals/ })).toHaveAccessibleDescription(message)
    await expect(page.getByLabel('Plan')).toHaveAccessibleDescription(message)
    expect(await db.responseCount(form.id)).toBe(0)
  })

  test('rejects answers that are too long', async ({ page, request }) => {
    const form = await createForm(request, { questions: [{ type: 'short_text', label: 'Name' }] })
    await page.goto(form.path)
    await page.getByLabel('Name').evaluate((el: HTMLInputElement) => {
      el.removeAttribute('maxlength')
      el.value = 'x'.repeat(501)
    })
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByLabel('Name')).toHaveAccessibleDescription('Your answer is too long.')
  })

  test('accepts a form where every answer is optional and empty', async ({ page, request }) => {
    const form = await createForm(request, { questions: [{ type: 'long_text', label: 'Anything else?' }] })
    await page.goto(form.path)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)
  })
})
