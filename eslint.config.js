import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.vercel/**'] },
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      // TypeScript owns identifier and redeclaration checks, including type-only names.
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
