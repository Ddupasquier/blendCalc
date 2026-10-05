// One registry for page metadata and publication boundaries. Unclassified pages fail the build.
// Repository-only sources are retained, but never emitted or indexed by the public site.
export const repositoryOnlyDocumentation = new Set([
	"README.md",
	"scripts/README.md",
	"docs/development/README.md",
	"docs/development/ui-functionality.md",
	"docs/development/authentication.md",
	"docs/development/user-profiles.md",
	"docs/development/ui-functionality/app-shell-and-authentication.md",
	"docs/development/ui-functionality/profile.md",
	"docs/development/ui-functionality/moderation.md",
	"docs/development/project-structure.md",
	"docs/development/environment.md",
	"docs/development/supabase-schema.md",
	"docs/development/testing.md",
	"docs/development/browser-testing.md",
	"docs/development/database-testing.md",
	"docs/development/blendCalcAPI/database-isolation.md",
	"docs/development/blendCalcAPI/public-release.md",
	"docs/development/api-structures/source-data-inventory.md",
	"docs/development/moderation.md",
	"docs/development/hosted-security.md",
	"docs/development/dev-rules/dev-rules.md",
	"docs/development/dev-rules/dev-rules-audit.md",
	"docs/development/versioning.md",
	"docs/development/google-discovery-strategy.md",
	"docs/development/documentation-site.md",
]);
const registeredSections = [
	{
		title: "Start here",
		pages: [
			[
				"docs/README.md",
				"",
				"Welcome",
				"Find your way around BlendCalc, one useful step at a time.",
			],
			[
				"README.md",
				"start/setup/",
				"Setup & commands",
				"Requirements, installation and the maintained command guide.",
			],
			[
				"docs/development/README.md",
				"development/",
				"Find the right guide",
				"Understand which document owns each subject.",
			],
		],
	},
	{
		title: "Core concepts",
		pages: [
			[
				"docs/development/ui-functionality.md",
				"development/ui-functionality/",
				"How the app fits together",
				"Follow food from Ingredients through Mix to Saved Recipes.",
			],
			[
				"docs/development/data-architecture.md",
				"development/data-architecture/",
				"Data architecture",
				"Where data lives, who owns it and how it moves.",
			],
			[
				"docs/development/shared-product-catalog.md",
				"development/shared-product-catalog/",
				"The food catalog",
				"Understand products, evidence, revisions and publication.",
			],
			[
				"docs/development/normalized-food-nutrients.md",
				"development/normalized-food-nutrients/",
				"Nutrition data",
				"Understand normalized nutrients and missing-value semantics.",
			],
			[
				"docs/development/authentication.md",
				"development/authentication/",
				"Accounts & authentication",
				"Origins, Google sign-in, passwords and multi-factor authentication.",
			],
			[
				"docs/development/user-profiles.md",
				"development/user-profiles/",
				"Profiles & preferences",
				"Identity, appearance, avatars and private food preferences.",
			],
		],
	},
	{
		title: "App guides & behavior",
		pages: [
			[
				"docs/user/README.md",
				"user/",
				"Using BlendCalc",
				"Organize foods, build a Mix and save useful recipes.",
			],
			[
				"docs/development/ui-functionality/ingredients.md",
				"development/ui-functionality/ingredients/",
				"Ingredients",
				"The detailed behavior of search, lists, scanning and nutrition details.",
			],
			[
				"docs/development/ui-functionality/mix.md",
				"development/ui-functionality/mix/",
				"Mix",
				"Amounts, goals, warnings and recipe preparation.",
			],
			[
				"docs/development/ui-functionality/saved-recipes.md",
				"development/ui-functionality/saved-recipes/",
				"Saved Recipes",
				"Recipe discovery, loading, sharing and deletion.",
			],
			[
				"docs/development/ui-functionality/profile.md",
				"development/ui-functionality/profile/",
				"Profile",
				"Appearance, food preferences and account settings.",
			],
			[
				"docs/development/ui-functionality/app-shell-and-authentication.md",
				"development/ui-functionality/app-shell-and-authentication/",
				"Navigation & sign-in",
				"The app shell, authentication screens and guided tutorial.",
			],
			[
				"docs/development/ui-functionality/moderation.md",
				"development/ui-functionality/moderation/",
				"Moderator screens",
				"Review surfaces and privileged interactions.",
			],
		],
	},
	{
		title: "Developer reference",
		pages: [
			[
				"docs/development/project-structure.md",
				"development/project-structure/",
				"Project structure",
				"Find the right home for code, tests, scripts and docs.",
			],
			[
				"docs/development/style-guide.md",
				"development/style-guide/",
				"Design system",
				"BlendCalc’s Ingredients-derived visual language and tokens.",
			],
			[
				"docs/development/environment.md",
				"development/environment/",
				"Environments",
				"Keep production, QA and disposable sandboxes separate.",
			],
			[
				"docs/development/supabase-schema.md",
				"development/supabase-schema/",
				"Database schema",
				"Tables, relationships, functions, policies and Storage.",
			],
			[
				"docs/development/testing.md",
				"development/testing/",
				"Testing strategy",
				"Choose the smallest test layer that proves the behavior.",
			],
			[
				"docs/development/browser-testing.md",
				"development/browser-testing/",
				"Browser testing",
				"Playwright setup, cross-browser coverage and evidence.",
			],
			[
				"docs/development/database-testing.md",
				"development/database-testing/",
				"Database testing",
				"Local Supabase, seeded personas and policy verification.",
			],
			[
				"docs/development/blendCalcAPI/README.md",
				"development/blendCalcAPI/",
				"blendCalcAPI",
				"The food-data API, its status and supported endpoints.",
			],
			[
				"docs/development/blendCalcAPI/database-isolation.md",
				"development/blendCalcAPI/database-isolation/",
				"API database isolation",
				"The separate publication database and its boundaries.",
			],
			[
				"docs/development/blendCalcAPI/catalog-field-lineage.md",
				"development/blendCalcAPI/catalog-field-lineage/",
				"API field lineage",
				"Where published product fields come from.",
			],
			[
				"docs/development/blendCalcAPI/public-release.md",
				"development/blendCalcAPI/public-release/",
				"API release requirements",
				"The review and approval gates for public access.",
			],
			[
				"docs/development/api-structures/README.md",
				"development/api-structures/",
				"Provider references",
				"Find source capabilities and generated provider contracts.",
			],
			[
				"docs/development/api-structures/source-data-inventory.md",
				"development/api-structures/source-data-inventory/",
				"Source data inventory",
				"Which providers supply which fields and evidence.",
			],
			[
				"docs/development/barcode-scanning.md",
				"development/barcode-scanning/",
				"Barcodes & scanning",
				"Supported codes, scanner behavior and privacy.",
			],
			[
				"docs/development/moderation.md",
				"development/moderation/",
				"Moderation",
				"Roles, account controls, review workflows and evidence.",
			],
			[
				"scripts/README.md",
				"reference/scripts/",
				"Script reference",
				"Operational commands, ownership and safety boundaries.",
			],
		],
	},
	{
		title: "Troubleshooting",
		pages: [
			[
				"docs/development/hosted-security.md",
				"development/hosted-security/",
				"Security & recovery",
				"Hosted protection, backups and recovery procedures.",
			],
		],
	},
	{
		title: "Project information",
		pages: [
			[
				"docs/development/dev-rules/dev-rules.md",
				"development/dev-rules/dev-rules/",
				"Development rules",
				"The engineering contract and complete change lifecycle.",
			],
			[
				"docs/development/dev-rules/dev-rules-audit.md",
				"development/dev-rules/dev-rules-audit/",
				"Development audit",
				"The repeatable method for checking the rules.",
			],
			[
				"docs/development/versioning.md",
				"development/versioning/",
				"Versions & releases",
				"How application, API and schema versions stay independent.",
			],
			[
				"docs/development/data-source-licensing.md",
				"development/data-source-licensing/",
				"Source rights & attribution",
				"Licensing, attribution, storage and redistribution requirements.",
			],
			[
				"docs/development/google-discovery-strategy.md",
				"development/google-discovery-strategy/",
				"Discovery strategy",
				"Google Search, Discover and Play eligibility.",
			],
			[
				"docs/development/documentation-site.md",
				"development/documentation-site/",
				"Maintaining this site",
				"Preview, add pages and prepare a GitHub Pages build.",
			],
		],
	},
];

const publicPages = registeredSections.flatMap((section) =>
	section.pages.filter(([source]) => !repositoryOnlyDocumentation.has(source)),
);
const startingSources = new Set(["docs/README.md", "docs/user/README.md"]);

// Mixed reference documents also contain internal operating instructions. Only these
// reviewed sections appear on the site; the original documents remain unchanged.
export const publishedReferenceSections = new Map([
	[
		"docs/development/data-architecture.md",
		[
			"purpose",
			"read-flow",
			"write-flow",
			"browser-state",
			"serving-provenance-and-conversion",
			"nutrient-values-and-uncertainty",
			"module-boundaries",
		],
	],
	[
		"docs/development/shared-product-catalog.md",
		[
			"user-flow",
			"source-policy",
			"serving-data",
			"runtime-source-boundary",
			"catalog-security-boundary",
			"verification-rules",
			"nutrition-completeness-flow",
			"product-identifier-qr-codes",
			"source-lifecycle",
		],
	],
	[
		"docs/development/normalized-food-nutrients.md",
		[
			"data-ownership",
			"synchronization",
			"application-reads",
			"access-control",
			"example-queries",
		],
	],
	[
		"docs/development/style-guide.md",
		[
			"purpose-and-scope",
			"visual-direction",
			"color-system",
			"typography",
			"spacing-and-layout",
			"borders-focus-and-depth",
			"component-selection",
			"ingredients-page-patterns",
			"feedback-and-user-facing-messages",
			"motion-and-interaction",
		],
	],
	[
		"docs/development/blendCalcAPI/README.md",
		[
			"blendcalcapi-v1-status",
			"access-scopes",
			"read-endpoints",
			"provider-independence",
			"request-bounds",
			"what-can-be-published",
			"privacy-and-rights",
			"versioning",
			"related-provider-documentation",
		],
	],
	[
		"docs/development/data-source-licensing.md",
		[
			"compliance-model",
			"status-summary",
			"usda-fooddata-central",
			"open-food-facts",
			"cola-cloud",
			"fda-food-safety-notices",
			"usda-fsis-recalls-and-public-health-alerts",
			"canadian-nutrient-file-2026",
			"uk-cofid-2021",
			"australian-food-composition-database-release-3",
			"ucum-unit-standard",
			"gs1-digital-link",
			"nutrition-label-ocr-and-tesseractjs",
			"product-images",
			"community-and-user-label-data",
			"retired-or-inactive-sources",
		],
	],
]);

export const repositoryOnlyReferenceSections = new Map([
	[
		"docs/development/blendCalcAPI/README.md",
		["inspect-the-published-catalog-in-supabase"],
	],
]);

export const documentationSections = [
	{
		title: "Start here",
		pages: publicPages.filter(([source]) => startingSources.has(source)),
	},
	{
		title: "For developers",
		pages: publicPages.filter(([source]) => !startingSources.has(source)),
	},
];

export const documentationPages = documentationSections.flatMap((section) =>
	section.pages.map(([source, route, title, description]) => ({
		source,
		route,
		title,
		description,
		section: section.title,
	})),
);
