/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.\\.?/.*)\\.js$': '$1',
    '^multiformats/(.*)$': '<rootDir>/node_modules/multiformats/dist/src/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@noble/ed25519|multiformats|uint8arrays)/)'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    'node_modules/.+\\.js$': 'ts-jest'
  }
};
