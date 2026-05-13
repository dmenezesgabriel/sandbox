// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import lit from 'eslint-plugin-lit';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'storybook-static'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      lit,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/components/**/*.ts'],
    plugins: { lit },
    rules: {
      ...lit.configs.recommended.rules,
    },
  },
  storybook.configs['flat/recommended'],
);
