import { sveltekit, type Config } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";
import {
	createInactiveSvelteKitOutputWatchPattern,
	createConnectSources,
	createFrameSources,
	createImageSources,
	createScriptSources,
	createSvelteKitOutputDirectory,
	createWorkerSources,
	readViteMode,
} from "./config/contentSecurityPolicy.js";

const viteMode = readViteMode();
const packageMetadata = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const deploymentReference = (
	process.env.VERCEL_GIT_COMMIT_SHA ??
	process.env.GITHUB_SHA ??
	"local"
).slice(0, 12);
const buildVersion = `${packageMetadata.version}+${deploymentReference}`;
type CspDirectives = NonNullable<NonNullable<Config["csp"]>["directives"]>;

// SvelteKit 3 loads dotenv independently of Vite's envDir:false. Its required
// directory remains empty so launchers/deployment alone supply environment values.
const cacheDirectory = fileURLToPath(new URL("./.cache", import.meta.url));
const processEnvironmentDirectory = fileURLToPath(
	new URL("./.cache/process-only-environment", import.meta.url),
);
for (const directory of [cacheDirectory, processEnvironmentDirectory]) {
	if (!existsSync(directory)) mkdirSync(directory, { mode: 0o700 });
	if (
		!lstatSync(directory).isDirectory() ||
		lstatSync(directory).isSymbolicLink()
	)
		throw new Error(
			"Process-only environment directories must be regular directories.",
		);
}
if (readdirSync(processEnvironmentDirectory).length !== 0)
	throw new Error("The process-only environment directory must remain empty.");

const browserDependentUtilityTests = [
	"tests/lib/utils/accessibility/backdropDismissal.test.ts",
	"tests/lib/utils/accessibility/dialogFocus.test.ts",
	"tests/lib/utils/animation/animatedDetails.test.ts",
	"tests/lib/utils/animation/directionalExit.test.ts",
	"tests/lib/utils/animation/motion.test.ts",
	"tests/lib/utils/barcode/scanner.test.ts",
	"tests/lib/utils/food/customFoods.test.ts",
	"tests/lib/utils/food/selectedImagePreviewClient.test.ts",
	"tests/lib/utils/food/smartImagePlacementClient.test.ts",
	"tests/lib/utils/food/smartImagePlacement.test.ts",
	"tests/lib/utils/interaction/longPress.test.ts",
	"tests/lib/utils/mix/mixDraftPersistenceController.test.ts",
	"tests/lib/utils/mix/mixState.test.ts",
	"tests/lib/utils/mix/savedRecipeController.test.ts",
	"tests/lib/utils/storage/dailyWelcome.test.ts",
	"tests/lib/utils/storage/ingredientLists.test.ts",
	"tests/lib/utils/storage/savedRecipes.test.ts",
	"tests/lib/utils/storage/storageScope.test.ts",
	"tests/lib/utils/theme/themePreference.test.ts",
];

const nodeOwnedComponentTests = [
	"tests/lib/components/common/ImagePlacementViewportCsp.test.ts",
];

const threadIsolatedDomTests = [
	"tests/lib/components/ingredients/NutritionLabelOcrInput.test.ts",
];

const jsdomTestFiles = [
	"tests/lib/components/**/*.{test,spec}.{js,mjs,ts}",
	...browserDependentUtilityTests,
];

export default defineConfig({
	// Environment ownership is explicit at each launcher or deployment boundary.
	// Never layer ambient repository dotenv files into Vite.
	envDir: false,
	resolve: {
		alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
	},
	ssr: { external: ["ws"] },
	plugins: [
		sveltekit({
			env: { dir: processEnvironmentDirectory },
			preprocess: vitePreprocess(),
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
			},
			outDir: createSvelteKitOutputDirectory(),
			version: { name: buildVersion, pollInterval: 0 },
			adapter: adapter(),
			csp: {
				mode: "auto",
				directives: {
					"default-src": ["self"],
					"base-uri": ["self"],
					"connect-src": createConnectSources(
						undefined,
						process.env,
					) as CspDirectives["connect-src"],
					"font-src": ["self", "data:"],
					"form-action": ["self"],
					"frame-ancestors": ["none"],
					"frame-src": createFrameSources() as CspDirectives["frame-src"],
					"img-src": createImageSources(
						undefined,
						process.env,
					) as CspDirectives["img-src"],
					"object-src": ["none"],
					"script-src": createScriptSources() as CspDirectives["script-src"],
					"worker-src": createWorkerSources() as CspDirectives["worker-src"],
					"style-src": ["self", "unsafe-inline"],
				},
			},
		}),
		svelteTesting(),
	],
	optimizeDeps: {
		exclude: [
			"@jsquash/jpeg",
			"@jsquash/png",
			"@jsquash/resize",
			"@jsquash/webp",
		],
	},
	build: {
		target: ["chrome111", "edge111", "firefox113", "safari16.4"],
		cssTarget: ["chrome111", "edge111", "firefox113", "safari16.4"],
	},
	server: {
		watch: {
			ignored: [
				"**/.cache/**",
				"**/playwright-report/**",
				"**/test-results/**",
				createInactiveSvelteKitOutputWatchPattern(viteMode),
			],
		},
	},
	test: {
		exclude: ["tests/e2e/**"],
		globals: true,
		maxWorkers: 4,
		pool: "threads",
		projects: [
			{
				extends: true,
				resolve: { conditions: ["node", "development"] },
				ssr: { resolve: { conditions: ["node", "development"] } },
				test: {
					name: "node",
					pool: "threads",
					include: [
						"tests/{config,hooks,routes,scripts,supabase}/**/*.{test,spec}.{js,mjs,ts}",
						"tests/lib/{blendCalcAPI,config,server,supabase,utils}/**/*.{test,spec}.{js,mjs,ts}",
						...nodeOwnedComponentTests,
					],
					exclude: jsdomTestFiles,
					environment: "node",
					setupFiles: ["tests/test-reference-catalog-setup.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "dom",
					// Kit 3's module graph needs file-isolated runtime imports: VM
					// dependency caching can retain another file's DOM and mocks.
					pool: "threads",
					include: jsdomTestFiles,
					exclude: [...nodeOwnedComponentTests, ...threadIsolatedDomTests],
					environment: "jsdom",
					setupFiles: ["tests/test-setup.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "dom-svelte-runtime",
					pool: "threads",
					include: threadIsolatedDomTests,
					environment: "jsdom",
					setupFiles: ["tests/test-setup.ts"],
				},
			},
		],
	},
});
