// Flat config (ESLint 9+). eslint-config-expo bundles the React Native /
// React Hooks / import rules tuned for Expo projects.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // Pin the React version so eslint-plugin-react skips runtime detection,
    // whose getFilename() call crashes under ESLint 10's flat-config context.
    settings: { react: { version: '19.2' } },
  },
  {
    // --- Lint-adoption ratchet ---------------------------------------------
    // This codebase had never been linted; these rules currently have existing
    // violations. They're demoted to `warn` so the CI gate is green today and
    // only NEW error-level breakage blocks. Burn the backlog down per rule,
    // then promote each back to `error`. Run `yarn lint` to see the warnings.
    files: ['**/*.ts', '**/*.tsx', '**/*.jsx'],
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-unused-expressions': 'warn',
    },
  },
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'node_modules/*',
      'supabase/functions/**', // Deno runtime — separate toolchain, excluded from tsconfig too
      'src/types/database.generated.ts', // generated
    ],
  },
];
