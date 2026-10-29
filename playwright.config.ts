import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, E2E_ENV, PORT } from './e2e/env'

const CI = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /branding\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /public-.*\.spec\.ts/ },
    // Branding is global state that changes every page, so it runs alone after everything else.
    { name: 'branding', use: { ...devices['Desktop Chrome'] }, testMatch: /branding\.spec\.ts/, dependencies: ['chromium', 'mobile'] },
  ],
  // A production build, like the Docker image runs it.
  webServer: {
    command: 'npm run build && npm start',
    url: `${BASE_URL}/api/healthz`,
    env: { ...E2E_ENV, PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
