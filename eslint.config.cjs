const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'ios/**', 'android/**', 'artifacts/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use an approved seeded randomness stream; gameplay and visual streams must be separate.' },
      ],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Game rules must not depend on wall-clock time.' },
        { name: 'performance', message: 'Game rules must not depend on frame timing.' },
        { name: 'fetch', message: 'The game layer is platform independent.' },
      ],
    },
  },
]);
