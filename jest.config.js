export default {
  testEnvironment: 'node',
  testRegex: '.*\\.test\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/local/'],
  setupFiles: ['dotenv/config'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
};
