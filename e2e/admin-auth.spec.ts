import { SESSION_COOKIE, createSession } from '../lib/session'
import { BASE_URL, E2E_ENV } from './env'
import { expect, formAlert, submit, test } from './fixtures'

test.describe('admin sign-in', () => {
  for (const path of ['/admin', '/admin/branding', '/admin/forms/00000000-0000-0000-0000-000000000000']) {
    test(`${path} requires a session`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL('/admin/login')
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    })
  }

  test('rejects forged and expired session cookies', async ({ page, context }) => {
    const expired = await createSession(E2E_ENV.REFORM_SESSION_SECRET, Date.now() - 13 * 60 * 60 * 1000)
    const forged = await createSession('some-other-secret-with-32-characters!')
    for (const value of ['garbage', expired, forged]) {
      await context.clearCookies()
      await context.addCookies([{ name: SESSION_COOKIE, value, url: BASE_URL }])
      await page.goto('/admin')
      await expect(page).toHaveURL('/admin/login')
    }
  })

  test('signs in with the admin password and out again', async ({ page, context }) => {
    await page.goto('/admin/login')
    await expect(page.getByLabel('Password')).toBeFocused()
    await page.getByLabel('Password').fill('wrong password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(formAlert(page)).toHaveText('The password is wrong.')
    await expect(page).toHaveURL('/admin/login')

    await page.getByLabel('Password').fill(E2E_ENV.REFORM_ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/admin')
    await expect(page.getByRole('heading', { name: 'Forms' })).toBeVisible()

    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE)
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', secure: false, path: '/' })
    expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(11 * 60 * 60 * 1000)

    // The login page sends signed-in admins on.
    await page.goto('/admin/login')
    await expect(page).toHaveURL('/admin')

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL('/admin/login')
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false)
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/login')
  })

  test('limits sign-in attempts per client IP', async ({ page }) => {
    await page.goto('/admin/login')
    for (let i = 0; i < 10; i++) {
      await page.getByLabel('Password').fill(`wrong ${i}`)
      await submit(page, 'Sign in')
      await expect(formAlert(page)).toHaveText('The password is wrong.')
      // React resets the form after the action; filling before that would be wiped.
      await expect(page.getByLabel('Password')).toHaveValue('')
    }
    // Even the right password is refused now.
    await page.getByLabel('Password').fill(E2E_ENV.REFORM_ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(formAlert(page)).toHaveText('Too many attempts. Please wait 15 minutes.')
    await expect(page).toHaveURL('/admin/login')
  })

  test('the export needs a session', async ({ request, form }) => {
    const response = await request.get(`/admin/forms/${form.id}/export`, { maxRedirects: 0 })
    // The proxy redirects before the route's own 401 check is reached.
    expect(response.status()).toBe(307)
    expect(response.headers()['location']).toBe('/admin/login')
  })

  test('the root redirects to the admin when no website is set', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/admin/login')
  })
})
