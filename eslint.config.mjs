import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettierConfig from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  prettierConfig, // Add Prettier config to the extends array
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])
])

export default eslintConfig
