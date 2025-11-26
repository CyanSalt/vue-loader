import config from '@cyansalt/eslint-config'

export default config({
  configs: [
    {
      ignores: ['tests/fixtures'],
    },
    {
      languageOptions: {
        parserOptions: {
          project: [
            './tsconfig.lib.json',
            './tsconfig.node.json',
          ],
        },
      },
      rules: {
        'max-params': 'off',
        'unicorn/prefer-node-protocol': 'off',
        'unicorn/prefer-optional-catch-binding': 'off',
      },
    },
    {
      files: ['lib/runtime/*.js'],
      rules: {
        'no-var': 'off',
        'object-shorthand': ['warn', 'never'],
        '@stylistic/ts/comma-dangle': ['warn', 'never'],
      },
    },
  ],
})
