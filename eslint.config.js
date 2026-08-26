import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import typescript from "typescript-eslint";

export default defineConfig(
	globalIgnores([
		".svelte-kit/**",
		".vercel/**",
		"build/**",
		"coverage/**",
		"dist/**",
		"node_modules/**",
		"playwright-report/**",
		"scripts/output/**",
		"supabase/.temp/**",
		"docs/development/api-structures/*.reference.ts",
		"src/lib/types/database.types.ts",
		"test-results/**",
	]),
	js.configs.recommended,
	typescript.configs.recommended,
	svelte.configs.recommended,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			eqeqeq: ["error", "always", { null: "ignore" }],
			"no-empty": ["error", { allowEmptyCatch: true }],
			"no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
			"svelte/no-navigation-without-resolve": "warn",
		},
	},
	{
		files: ["**/*.svelte", "**/*.svelte.js", "**/*.svelte.ts"],
		languageOptions: {
			parserOptions: {
				extraFileExtensions: [".svelte"],
				parser: typescript.parser,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-expressions": "off",
			"svelte/no-navigation-without-resolve": "warn",
			"svelte/no-unused-svelte-ignore": "off",
			"svelte/prefer-svelte-reactivity": "warn",
			"svelte/prefer-writable-derived": "warn",
			"svelte/require-each-key": "warn",
		},
	},
);
