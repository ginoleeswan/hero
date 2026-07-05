// Flat config (ESLint 9+). eslint-config-expo bundles the React Native /
// React Hooks / import rules tuned for Expo projects.
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = [
  ...expoConfig,
  {
    // Node tooling scripts (portrait generation, social pipelines, design-sync).
    // These run under Node, not the RN/web bundle, so they get Node globals
    // (Buffer, process, …). `playwright-core` is an optional, dynamically
    // imported peer the operator installs ad-hoc — not a tracked dependency —
    // so import resolution is off here.
    files: ['scripts/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'import/no-unresolved': 'off' },
  },
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
      'no-unused-expressions': 'warn',
    },
  },
  {
    // `@typescript-eslint` rules must be scoped to the files for which
    // eslint-config-expo registers the plugin (.ts/.tsx). Applying them to
    // .jsx/.js too crashes ESLint with "could not find plugin".
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'node_modules/*',
      'supabase/functions/**', // Deno runtime — separate toolchain, excluded from tsconfig too
      'src/types/database.generated.ts', // generated
      '.design-sync/**', // Claude Design sync tooling — previews import the bundled DS pkg, separate from the app module graph
      '.ds-sync/**', // design-sync tooling output (gitignored; ESLint ignores .gitignore)
      '.ds-pkg/**', // design-sync build artifacts (gitignored; ESLint ignores .gitignore)
      'ds-bundle/**', // design-sync bundle/vendor output (gitignored)
    ],
  },
];
