import { createForm, expect, fillAll, test } from './fixtures'

const unavailable = 'This form is no longer available'

test.describe('form lifetime', () => {
  test('a single-use link closes after the first response', async ({ page, request, db }) => {
    const form = await createForm(request, { lifetime: { singleUse: true } })
    await page.goto(form.path)
    await fillAll(page)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page).toHaveURL(`${form.path}/thanks`)

    await page.goto(form.path)
    await expect(page.getByRole('heading', { name: unavailable })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit' })).toHaveCount(0)
    expect(await db.responseCount(form.id)).toBe(1)
  })

  test('only one of two simultaneous submits on a single-use link succeeds', async ({ browser, request, db }) => {
    const form = await createForm(request, { lifetime: { singleUse: true } })
    const pages = await Promise.all([0, 1].map(async () => (await browser.newContext()).newPage()))
    for (const p of pages) {
      await p.goto(form.path)
      await fillAll(p)
    }
    await Promise.all(pages.map((p) => p.getByRole('button', { name: 'Submit' }).click()))
    await Promise.all(pages.map((p) => expect(p.getByRole('heading', { name: /Thank you|no longer available/ })).toBeVisible()))

    const thanked = pages.filter((p) => p.url().endsWith('/thanks'))
    expect(thanked).toHaveLength(1)
    expect(await db.responseCount(form.id)).toBe(1)
    await Promise.all(pages.map((p) => p.context().close()))
  })

  test('a link with an expiry date accepts many responses', async ({ page, form, db }) => {
    for (let i = 0; i < 2; i++) {
      await page.goto(form.path)
      await fillAll(page)
      await page.getByRole('button', { name: 'Submit' }).click()
      await expect(page).toHaveURL(`${form.path}/thanks`)
    }
    expect(await db.responseCount(form.id)).toBe(2)
  })

  test('an expired link shows the unavailable page', async ({ page, form, db }) => {
    await db.expireForm(form.id)
    await page.goto(form.path)
    await expect(page.getByRole('heading', { name: unavailable })).toBeVisible()
    await expect(page.getByText('It has already been completed or has expired.')).toBeVisible()
  })

  test('a closed link shows the unavailable page', async ({ page, form, db }) => {
    await db.closeForm(form.id)
    await page.goto(form.path)
    await expect(page.getByRole('heading', { name: unavailable })).toBeVisible()
  })

  test('a form that expires while it is open rejects the submit', async ({ page, form, db }) => {
    await page.goto(form.path)
    await fillAll(page)
    await db.expireForm(form.id)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByRole('heading', { name: unavailable })).toBeVisible()
    expect(await db.responseCount(form.id)).toBe(0)
  })
})
