import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, fillAll, formAlert, signIn, test } from './fixtures'

/** No serious or critical WCAG 2.1 A/AA violations on the current page. */
async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

// The panels fade in; axe would measure colour contrast mid-animation.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

test.describe('accessibility', () => {
  test('public form, with and without errors', async ({ page, form }) => {
    await page.goto(form.path)
    await expectAccessible(page)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(formAlert(page)).toBeVisible()
    await expectAccessible(page)
  })

  test('thank-you, unavailable and 404 pages', async ({ page, form, db }) => {
    await page.goto(form.path)
    await fillAll(page)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)
    await expectAccessible(page)

    await db.expireForm(form.id)
    await page.goto(form.path)
    await expectAccessible(page)

    await page.goto('/f/unknown')
    await expectAccessible(page)
  })

  test('admin pages', async ({ page, context, form }) => {
    await page.goto('/admin/login')
    await expectAccessible(page)
    await signIn(context)
    for (const path of ['/admin', `/admin/forms/${form.id}`, '/admin/branding']) {
      await page.goto(path)
      await expectAccessible(page)
    }
  })

  test('the public form can be answered with the keyboard alone', async ({ page, form, db }) => {
    await page.goto(form.path)
    await page.getByLabel('Your name').focus()
    await page.keyboard.type('Keyboard User')
    await page.keyboard.press('Tab') // about
    await page.keyboard.press('Tab') // email
    await page.keyboard.type('keys@example.com')
    // Phone, budget and the date input (one tab stop per date segment) come next.
    const firstSize = page.getByRole('radio', { name: 'Just me' })
    for (let i = 0; i < 10 && !(await firstSize.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab')
    }
    await expect(firstSize).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.getByRole('radio', { name: 'Just me' })).toBeChecked()
    await page.getByRole('radio', { name: 'No' }).focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${form.path}/thanks`)
    expect(await db.responseCount(form.id)).toBe(1)
  })
})
