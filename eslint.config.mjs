import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'out/**',
    'coverage/**',
    'next-env.d.ts',
    'public/**',
    'playtest-output/**',
  ]),
  {
    rules: {
      // React Compiler diagnostics — this codebase does not enable the
      // compiler; pages use the classic fetch-in-effect idiom which is
      // correct on React 19. Real purity/ref rules stay enabled.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
