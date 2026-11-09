module.exports = {
  root: true,
  extends: ['@electron-toolkit'],
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  ignorePatterns: ['node_modules', 'out', 'dist', 'src/**/*.ts', 'src/**/*.tsx']
}
