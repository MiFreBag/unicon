/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: false,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
};