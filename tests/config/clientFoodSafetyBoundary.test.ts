import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (path: string) => readFileSync(join(root, path), "utf8");

describe("client food-safety boundary", () => {
	it("keeps compatibility policy out of the browser reference catalog", () => {
		const catalog = readSource(
			"src/lib/utils/food/reference/appReferenceCatalog.ts",
		);
		const loader = readSource(
			"src/lib/utils/food/reference/appReferenceData.ts",
		);
		const layout = readSource("src/routes/+layout.server.ts");

		for (const source of [catalog, loader, layout]) {
			expect(source).not.toContain("foodPreferenceConflictRules");
			expect(source).not.toContain("foodCompatibilityMatchRules");
			expect(source).not.toContain("food_compatibility_match_rules");
			expect(source).not.toContain("compatibility_rule_conflicts");
		}
	});

	it("renders only server-precomputed warnings and disclosures", () => {
		const warnings = readSource(
			"src/lib/utils/profile/foodPreferenceWarnings.ts",
		);
		const compatibilityPanel = readSource(
			"src/lib/components/ingredients/nutrition/ProductCompatibilityPanel/ProductCompatibilityPanel.svelte",
		);

		expect(warnings).toContain("food.preferenceWarnings");
		expect(warnings).not.toMatch(
			/\.(?:allergens|traces|ingredients|compatibilitySummary)\b/,
		);
		expect(warnings).not.toContain("RegExp");
		expect(compatibilityPanel).toContain("food.allergenDisclosure");
		expect(compatibilityPanel).toContain("food.compatibilitySummary");
		expect(compatibilityPanel).not.toMatch(/food\.(?:allergens|traces)\b/);
	});

	it("keeps package declaration parsing in server-only ingestion code", () => {
		const mapper = readSource(
			"src/lib/utils/barcode/barcodeProductMappers.ts",
		);
		const clientFacade = readSource(
			"src/lib/utils/barcode/productLookup.ts",
		);

		expect(mapper).toContain(
			"$lib/server/products/allergenDeclarations.server.js",
		);
		expect(clientFacade).not.toContain("mapOpenFoodFactsProduct");
		expect(clientFacade).not.toContain("mapFdcBarcodeFood");
		expect(clientFacade).not.toContain("mapSharedCatalogFood");
	});

	it("keeps list allergen hydration and evaluation behind server routes", () => {
		const browserLists = readSource(
			"src/lib/utils/storage/client/smoothieLists.ts",
		);
		const browserSavedDrinks = readSource(
			"src/lib/utils/storage/client/savedDrinks.ts",
		);
		const cloudMutations = readSource(
			"src/lib/utils/storage/supabase/lists.ts",
		);
		const serverHydration = readSource(
			"src/lib/server/user-data/listHydration.server.ts",
		);

		for (const source of [browserLists, browserSavedDrinks, cloudMutations]) {
			expect(source).not.toContain("hydrateCloudFoodListRows");
			expect(source).not.toMatch(/\.(?:allergens|traces|compatibilitySummary)\b/);
		}
		expect(browserLists).not.toContain("readCloudSmoothieList(");
		expect(browserSavedDrinks).not.toContain("readCloudSmoothieList(");
		expect(
			existsSync(
				join(root, "src/lib/utils/storage/supabase/listHydration.ts"),
			),
		).toBe(false);
		expect(serverHydration).toContain("allergens: canonicalFood.allergens");
		expect(serverHydration).toContain("traces: canonicalFood.traces");
		expect(serverHydration).not.toContain(
			"preferCanonicalValues(canonicalFood.allergens",
		);
		expect(serverHydration).not.toContain(
			"preferCanonicalValues(canonicalFood.traces",
		);
	});
});
