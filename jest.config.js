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

	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/infrastructure/repository/db/schema.ts',
		'!src/infrastructure/repository/db/index.ts',
		'!src/route.ts',
	],
	coverageReporters: ['text-summary', 'text', 'lcov', 'html'],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
		'src/service/**/*.ts': {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90,
		},
		'src/domain/**/*.ts': {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90,
		},
		'src/core/**/*.ts': {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90,
		},
		'src/controller/**/*.ts': {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
		'src/infrastructure/**/*.ts': {
			branches: 50,
			functions: 50,
			lines: 50,
			statements: 50,
		},
	},
};
