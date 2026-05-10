import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};

export default config;
