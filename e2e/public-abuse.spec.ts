import { formAlert, randomIp, submit, expect, fillAll, test } from './fixtures'

test.describe('bot protection', () => {
  test('a filled honeypot pretends success but stores nothing', async ({ page, form, db }) => {
    await page.goto(form.path)
    // Moved off-screen and out of the accessibility tree and tab order, so people never fill it.
    await expect(page.locator('.rf-honeypot')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('input[name="website_url"]')).toHaveAttribute('tabindex', '-1')
    await fillAll(page)
    await page.locator('input[name="website_url"]').evaluate((el: HTMLInputElement) => (el.value = 'https://spam.example'))
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)
    expect(await db.responseCount(form.id)).toBe(0)
  })

  test('submits are rate limited per client IP', async ({ page, browser, form, db }) => {
    // REFORM_SUBMIT_RATE_LIMIT_PER_HOUR is 5 in the e2e environment; failed submits count too.
    await page.goto(form.path)
    for (let i = 0; i < 5; i++) {
      // A failed submit remounts the form; wait for the new one so the next step does not act on the old.
      await page.locator('form').evaluate((form) => form.setAttribute('data-stale', ''))
      await submit(page)
      await expect(page.locator('form:not([data-stale])')).toBeAttached()
      await expect(formAlert(page)).toHaveText('Please check the highlighted fields.')
    }
    await fillAll(page)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(formAlert(page)).toHaveText('Too many attempts. Please try again later.')
    expect(await db.responseCount(form.id)).toBe(0)

    // Another visitor is not affected.
    const other = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } })
    const otherPage = await other.newPage()
    await otherPage.goto(form.path)
    await fillAll(otherPage)
    await otherPage.getByRole('button', { name: 'Submit' }).click()
    await expect(otherPage).toHaveURL(`${form.path}/thanks`)
    await other.close()
  })
})
