import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTs,
  // Playwright fixtures call their parameter `use`, which is not the React hook.
  { files: ['e2e/**'], rules: { 'react-hooks/rules-of-hooks': 'off' } },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**', 'blob-report/**'] },
]

export default config
