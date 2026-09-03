import { describe, expect, it } from "vitest";
import { APP_USER_AGENT } from "$lib/config/brand";
import {
	getOpenFoodFactsRequestBarcode,
	getOpenFoodFactsRequestedFields,
	OPEN_FOOD_FACTS_PRODUCT_API_BASE_URL,
	OPEN_FOOD_FACTS_PRODUCT_API_VERSION,
} from "$lib/server/products/sources/openFoodFactsRequestPolicy";
import { getProductApiCacheKey } from "$lib/server/products/productApiCacheKey";
import { getBarcodeProductDesiredSourceFieldPaths } from "$lib/utils/barcode/barcodeProductEnrichment";

describe("Open Food Facts request policy", () => {
	it("sends one provider-normalized barcode instead of probing leading-zero variants", () => {
		expect(getOpenFoodFactsRequestBarcode("030000581728")).toBe("030000581728");
		expect(getOpenFoodFactsRequestBarcode("00030000581728")).toBe(
			"0030000581728",
		);
		expect(getOpenFoodFactsRequestBarcode("not-a-barcode")).toBeNull();
	});

	it("requests only identity fields when no supplement fields are needed", () => {
		expect(getOpenFoodFactsRequestedFields(["productIdentity"])).toEqual([
			"code",
			"generic_name",
			"product_name",
		]);
	});

	it("keeps all requested nutrients in one bounded nutriments object", () => {
		const fields = getOpenFoodFactsRequestedFields([
			"nutrient:1008",
			"nutrient:1003",
		]);

		expect(fields.filter((field) => field === "nutriments")).toHaveLength(1);
		expect(fields).toEqual(
			expect.arrayContaining([
				"nutrition_data_per",
				"serving_quantity",
				"serving_quantity_unit",
			]),
		);
		expect(fields).not.toContain("image_front_url");
		expect(fields).not.toContain("ingredients");
	});

	it("uses tags_sources fields instead of obsolete hierarchy fields", () => {
		const fields = getOpenFoodFactsRequestedFields([
			"categories",
			"allergens",
			"traces",
			"sourceMetadata",
		]);

		expect(fields).toContain("tags_sources");
		expect(fields.some((field) => field.endsWith("_hierarchy"))).toBe(false);
		expect(fields.some((field) => field.endsWith("_lc"))).toBe(false);
	});

	it("identifies the app with a contact email in the provider user agent", () => {
		expect(APP_USER_AGENT).toMatch(/^blendCalc\/.+ \([^\s()]+@[^\s()]+\)$/);
	});

	it("uses the stable product endpoint that returns the requested nutriments object", () => {
		expect(OPEN_FOOD_FACTS_PRODUCT_API_VERSION).toBe("2");
		expect(OPEN_FOOD_FACTS_PRODUCT_API_BASE_URL).toBe(
			"https://world.openfoodfacts.org/api/v2/product",
		);
	});

	it("keeps the local QA UPC fixture aligned with the real request shape", () => {
		const fields = getOpenFoodFactsRequestedFields(
			getBarcodeProductDesiredSourceFieldPaths(),
		);
		expect(
			getProductApiCacheKey("barcode-product", {
				apiVersion: OPEN_FOOD_FACTS_PRODUCT_API_VERSION,
				barcode: "0030000581728",
				fields,
			}),
		).toBe("0e23d67b7eff5e4c3c4b23f6361d5d8926a60630ec04a114d2e02e231f38b733");
	});
});
