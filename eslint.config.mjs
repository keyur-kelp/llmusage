import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

const banned = ['@anthropic-ai/sdk', 'prisma', '@prisma/client', 'typeorm', 'knex'];

const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-restricted-imports': ['error', { paths: banned.map((name) => ({ name, message: `${name} is not allowed (see CLAUDE.md)` })) }],
  'no-restricted-globals': ['error', { name: 'parseFloat', message: 'No float math for money: use decimal.js' }],
  'no-restricted-properties': [
    'error',
    { object: 'Number', property: 'parseFloat', message: 'No float math for money: use decimal.js' },
    { property: 'sync', message: 'sequelize.sync() is forbidden: use migrations' },
  ],
  'no-console': 'off',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-migrations/**', '**/node_modules/**', '**/.angular/**', 'tests/acceptance/**', 'coverage/**', '**/*.cjs'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: sharedRules,
  },
  {
    // Money must never go through Number(): use decimal.js. Non-money uses (token/row counts) need an eslint-disable comment.
    files: ['backend/src/services/**/*.ts', 'backend/src/repositories/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='Number']", message: 'No Number() on money: use decimal.js. For counts, add an eslint-disable comment.' },
      ],
    },
  },
  {
    files: ['frontend/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['frontend/**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
);
