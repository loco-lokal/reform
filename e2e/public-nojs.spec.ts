import { formAlert, expect, test } from './fixtures'

// The public form must work as a plain HTML form.
test.use({ javaScriptEnabled: false })

test.describe('public form without JavaScript', () => {
  test('submits and reaches the thank-you page', async ({ page, form, db }) => {
    await page.goto(form.path)
    await page.getByLabel('Your name').fill('No Script')
    await page.getByLabel('Email address').fill('noscript@example.com')
    await page.getByRole('radio', { name: 'Just me' }).check({ force: true })
    await page.getByRole('radio', { name: 'No' }).check({ force: true })
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('heading', { name: 'Thank you for your answers!' })).toBeVisible()
    expect(await db.responseCount(form.id)).toBe(1)
  })

  test('shows server-side errors and keeps the answers', async ({ page, form }) => {
    await page.goto(form.path)
    await page.getByLabel('Your name').fill('No Script')
    await page.getByLabel('Email address').fill('not-an-email')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(formAlert(page)).toHaveText('Please check the highlighted fields.')
    await expect(page.getByLabel('Email address')).toHaveAccessibleDescription('Please enter a valid email address.')
    await expect(page.getByLabel('Your name')).toHaveValue('No Script')
  })
})
