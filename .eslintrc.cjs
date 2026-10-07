/**
 * Team lint rules. Run `npm run lint` before pushing.
 * Architecture rules (see DESIGN.md):
 *  - pages / components never touch localStorage or the mock database directly;
 *  - they call a service facade (src/services/<module>/*Service.js or src/services/*Service.js).
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended', 'prettier'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'error',
  },
  overrides: [
    {
      // UI layer: go through services, never through mocks / storage.
      files: ['src/pages/**', 'src/components/**'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [{ group: ['**/mocks/**', '@/mocks/*'], message: 'UI không import mock trực tiếp. Gọi service (src/services/<module>/*Service.js).' }] }],
        'no-restricted-globals': ['error', { name: 'localStorage', message: 'Không dùng localStorage trong UI. Lưu dữ liệu qua service.' }, { name: 'sessionStorage', message: 'Không dùng sessionStorage trong UI.' }],
      },
    },
  ],
};
