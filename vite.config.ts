import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

const browserDependentUtilityTests = [
	"tests/lib/utils/accessibility/backdropDismissal.test.ts",
	"tests/lib/utils/accessibility/dialogFocus.test.ts",
	"tests/lib/utils/animation/animatedDetails.test.ts",
	"tests/lib/utils/animation/directionalExit.test.ts",
	"tests/lib/utils/animation/motion.test.ts",
	"tests/lib/utils/barcode/scanner.test.ts",
	"tests/lib/utils/food/customFoods.test.ts",
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

const serverTestsRequiringSvelteKitBrowserRuntime = [
	"tests/lib/server/products/catalog.test.ts",
	"tests/lib/server/products/catalogSourceAssessment.test.ts",
	"tests/lib/server/products/colaCloudBarcodeProduct.test.ts",
	"tests/lib/server/products/externalProduct.test.ts",
	"tests/lib/server/products/productApiRequests.test.ts",
	"tests/lib/server/runtime/backgroundTask.test.ts",
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
	...serverTestsRequiringSvelteKitBrowserRuntime,
];

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	build: {
		target: ["chrome111", "edge111", "firefox113", "safari16.4"],
		cssTarget: ["chrome111", "edge111", "firefox113", "safari16.4"],
	},
	server: {
		watch: {
			ignored: ["**/playwright-report/**", "**/test-results/**"],
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
					pool: "vmThreads",
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
