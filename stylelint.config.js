export default {
	extends: ["stylelint-config-recommended-scss"],
	ignoreFiles: [
		".svelte-kit/**",
		".vercel/**",
		"build/**",
		"coverage/**",
		"dist/**",
		"node_modules/**",
		"playwright-report/**",
		"supabase/.temp/**",
		"test-results/**",
	],
	overrides: [
		{
			files: ["**/*.svelte"],
			customSyntax: "postcss-html",
		},
	],
	rules: {
		"scss/load-partial-extension": null,
		"scss/operator-no-newline-after": null,
		"selector-pseudo-class-no-unknown": [
			true,
			{
				ignorePseudoClasses: ["global"],
			},
		],
		"selector-class-pattern": [
			"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$",
			{
				message:
					"Use the established kebab-case or BEM-style class naming convention.",
				resolveNestedSelectors: true,
			},
		],
	},
};
