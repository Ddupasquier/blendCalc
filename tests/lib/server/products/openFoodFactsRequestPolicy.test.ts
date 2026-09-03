import { describe, expect, it } from "vitest";
import { APP_USER_AGENT } from "$lib/config/brand";
import {
	getOpenFoodFactsRequestBarcode,
	getOpenFoodFactsRequestedFields,
} from "$lib/server/products/sources/openFoodFactsRequestPolicy";

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

	it("uses current tags_sources fields instead of removed v3.6 hierarchy fields", () => {
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
});
