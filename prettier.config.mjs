/** @type {import('prettier').Config} */
const config = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',
  printWidth: 100,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: ['*.scss', '*.css'],
      options: { singleQuote: false },
    },
    {
      files: ['*.json'],
      options: { trailingComma: 'none' },
    },
  ],
}

export default config
