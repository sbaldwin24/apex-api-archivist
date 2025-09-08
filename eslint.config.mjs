import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginEslintComments from 'eslint-plugin-eslint-comments';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginJsdoc from 'eslint-plugin-jsdoc';
import eslintPluginPromise from 'eslint-plugin-promise';
import eslintPluginRegexp from 'eslint-plugin-regexp';
import eslintPluginSecurity from 'eslint-plugin-security';
import eslintPluginSonarjs from 'eslint-plugin-sonarjs';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default [
	/** Global ignores */
	{
		ignores: [
			'dist/',
			'build/',
			'coverage/',
			'node_modules/',
			'**/.min.',
			'client/coverage/',
			'scss/node_modules/',
			'webpack/node_modules/',
			'client/jest.config.mjs',
			'**/*.ts',
			'**/*.tsx'
		]
	},

	/** JavaScript baseline */
	js.configs.recommended,

	/** TypeScript configs - disabled due to Trunk compatibility issues */
	/** Main configuration */
	{
		files: ['client/**/*.{js,mjs,cjs,ts,cts,mts,tsx}'],

		languageOptions: {
			ecmaVersion: 'latest',
			globals: {
				console: 'readonly',
				document: 'readonly',
				module: 'readonly',
				process: 'readonly',
				require: 'readonly',
				window: 'readonly'
			},
			sourceType: 'module'
		},

		linterOptions: {
			reportUnusedDisableDirectives: true
		},

		plugins: {
			'@typescript-eslint': tseslint.plugin,
			'eslint-comments': eslintPluginEslintComments,
			import: eslintPluginImport,
			jsdoc: eslintPluginJsdoc,
			promise: eslintPluginPromise,
			regexp: eslintPluginRegexp,
			security: eslintPluginSecurity,
			sonarjs: eslintPluginSonarjs,
			unicorn: eslintPluginUnicorn
		},

		rules: {
			'@typescript-eslint/array-type': [
				'warn',
				{ default: 'array-simple', readonly: 'array-simple' }
			],

			/** TypeScript strictness */
			'@typescript-eslint/consistent-type-definitions': ['warn', 'type'],
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ fixStyle: 'separate-type-imports', prefer: 'type-imports' }
			],
			'@typescript-eslint/explicit-function-return-type': [
				'warn',
				{
					allowDirectConstAssertionInArrowFunctions: true,
					allowExpressions: true,
					allowHigherOrderFunctions: true
				}
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-inferrable-types': [
				'warn',
				{ ignoreParameters: true, ignoreProperties: true }
			],
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': [
				'warn',
				{ ignoreTernaryTests: false }
			],
			'@typescript-eslint/prefer-optional-chain': 'warn',
			complexity: ['warn', 10],

			/** ESLint comments hygiene */
			'eslint-comments/no-unused-disable': 'error',
			'id-length': 'off',
			'import/newline-after-import': 'error',
			'import/no-cycle': ['error', { maxDepth: 1 }],
			'import/no-default-export': 'error',
			'import/no-deprecated': 'warn',
			'import/no-duplicates': 'error',
			'import/no-extraneous-dependencies': [
				'error',
				{
					devDependencies: [
						'vite.config.{ts,cts,mts}',
						'eslint.config.*',
						'client/**/*.test.{ts,tsx}',
						'client/**/*.spec.{ts,tsx}',
						'client/**/tests/**',
						'**/*.config.{ts,cts,mts}',
						'scripts/**',
						'webpack/**',
						'e2e/**'
					]
				}
			],

			/** Imports && module hygiene */
			'import/order': [
				'error',
				{
					alphabetize: { caseInsensitive: true, order: 'asc' },
					groups: [
						['builtin', 'external'],
						['internal'],
						['parent', 'sibling', 'index'],
						['type']
					],
					'newlines-between': 'always'
				}
			],
			indent: ['error', 2],

			/** JSDoc */
			'jsdoc/require-jsdoc': 'off',
			'max-depth': ['warn', 3],
			'max-lines-per-function': [
				'warn',
				{ max: 80, skipBlankLines: true, skipComments: true }
			],
			'max-nested-callbacks': ['warn', 2],
			'max-params': ['warn', 4],
			'max-statements': ['warn', 25],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'no-plusplus': 'off',
			'no-shadow': 'off',
			'no-ternary': 'off',
			/** Turn off core rules in favor of TS-aware versions */
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'no-use-before-define': 'off',
			'no-void': ['error', { allowAsStatement: true }],

			/** General code cleanliness && complexity */
			'no-warning-comments': [
				'warn',
				{ location: 'start', terms: ['todo', 'fixme'] }
			],
			'one-var': 'off',
			'promise/no-multiple-resolved': 'error',

			/** Promises && async */
			'promise/prefer-await-to-then': 'warn',

			/** RegExp correctness && perf */
			'regexp/no-dupe-disjunctions': 'error',
			'regexp/optimal-quantifier-concatenation': 'error',
			'security/detect-non-literal-fs-filename': 'warn',

			/** Security */
			'security/detect-object-injection': 'off',

			/** SonarJS */
			'sonarjs/cognitive-complexity': ['warn', 15],
			'sonarjs/no-identical-functions': 'error',
			'unicorn/filename-case': [
				'error',
				{ cases: { camelCase: true, kebabCase: true, pascalCase: true } }
			],
			'unicorn/no-array-callback-reference': 'off',
			'unicorn/no-array-push-push': 'error',
			'unicorn/no-new-array': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-useless-length-check': 'error',

			/** Unicorn for modern best practices && perf */
			'unicorn/prefer-node-protocol': 'error',
			'unicorn/prefer-top-level-await': 'error',
			'unicorn/prevent-abbreviations': [
				'warn',
				{ replacements: { props: false, ref: false } }
			]
		},

		settings: {
			'import/resolver': {
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx']
				},
				typescript: {
					alwaysTryTypes: true
				}
			},
			jsdoc: { mode: 'typescript' }
		}
	},

	/** Test files configuration */
	{
		files: [
			'client/**/*.test.ts',
			'client/**/*.spec.ts',
			'client/**/tests/**/*.ts'
		],
		languageOptions: {
			globals: {
				jest: 'readonly'
			}
		},
		rules: {
			'@typescript-eslint/no-explicit-any': ['warn', { fixToUnknown: true }],
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'import/no-default-export': 'off'
		}
	},

	/** Node.js build && config files */
	{
		files: [
			'*.config.{js,mjs}',
			'build*.{js,mjs}',
			'webpack.config.*',
			'jest.config.*',
			'playwright.config.*'
		],
		languageOptions: {
			globals: {
				__dirname: 'readonly',
				__filename: 'readonly',
				Buffer: 'readonly',
				console: 'readonly',
				exports: 'readonly',
				global: 'readonly',
				module: 'readonly',
				process: 'readonly',
				require: 'readonly'
			},
			sourceType: 'module'
		},
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'import/no-default-export': 'off',
			'unicorn/prefer-node-protocol': 'off'
		}
	},

	/** CommonJS files */
	{
		files: ['**/*.cjs'],
		languageOptions: { sourceType: 'script' }
	},

	/** Prettier config to disable conflicting rules */
	eslintConfigPrettier,
	{
		overrides: [
			// other overrides,
			{
				extends: ['biome'],
				files: ['*.ts', '*.js', '*.tsx', '*.jsx']
			}
		]
	}
];
