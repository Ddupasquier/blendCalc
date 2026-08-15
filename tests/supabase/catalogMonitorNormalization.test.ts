import { describe, expect, it } from "vitest";
import {
	compareProviderSnapshots,
	hashJson,
	normalizeOpenFoodFactsSnapshot,
	normalizeUsdaSnapshot,
} from "../../supabase/functions/catalog-monitor/providerProducts.ts";
import {
	buildProbableSafetyAlertMatches,
	normalizeFsisAlert,
	normalizeOpenFdaAlert,
} from "../../supabase/functions/catalog-monitor/officialSafetyAlerts.ts";

describe("catalog provider change monitoring", () => {
	it("normalizes Open Food Facts fields without inventing missing values", () => {
		const snapshot = normalizeOpenFoodFactsSnapshot({
			product: {
				code: "00850000487260",
				product_name: "Sample Sauce",
				brands: "Example Foods",
				serving_size: "2 tbsp (30 g)",
				ingredients_text_en: "Tomatoes, salt",
				allergens_tags: ["en:milk"],
				traces_tags: ["en:soy"],
				nutriments: { fat_100g: 0, proteins_100g: 2 },
				rev: 4,
				last_updated_t: 1_787_000_000,
			},
		});

		expect(snapshot).toMatchObject({
			productName: "Sample Sauce",
			brandOwner: "Example Foods",
			allergens: ["en:milk"],
			traces: ["en:soy"],
			sourceMetadata: { barcode: "00850000487260", revision: 4 },
		});
		expect(snapshot.nutrition).toContainEqual({ key: "fat_100g", value: 0 });
		expect(snapshot.alcoholByVolume).toBeNull();
	});

	it("normalizes USDA data and reports only actual material differences", async () => {
		const previous = normalizeUsdaSnapshot({
			fdcId: 123,
			description: "Sample Food",
			brandOwner: "Example Foods",
			servingSize: 30,
			servingSizeUnit: "g",
			foodNutrients: [{
				amount: 2,
				nutrient: { id: 1003, name: "Protein", number: "203", unitName: "G" },
			}],
		});
		const observed = structuredClone(previous);
		observed.nutrition = [{
			id: 1003,
			name: "Protein",
			number: "203",
			unit: "G",
			amount: 3,
		}];

		expect(compareProviderSnapshots(previous, observed)).toEqual([{
			field: "nutrition",
			label: "Nutrition",
			severity: "high",
			previousValue: previous.nutrition,
			observedValue: observed.nutrition,
		}]);
		expect(await hashJson(previous)).toHaveLength(64);
		expect(await hashJson(previous)).not.toBe(await hashJson(observed));
	});
});

describe("official food safety alert normalization and matching", () => {
	const candidates = [{
		id: "7df1dc93-a498-4ce2-9df8-83fe2464c93d",
		barcode: "00011110129505",
		product_name: "Creamy Peanut Butter",
		brand_owner: "Example Pantry",
		food: { packageQuantity: { label: "16 oz" } },
	}];

	it("extracts exact package identifiers from openFDA records", () => {
		const alert = normalizeOpenFdaAlert({
			recall_number: "F-0001-2026",
			status: "Ongoing",
			classification: "Class I",
			product_description: "Example Pantry Creamy Peanut Butter",
			product_quantity: "16 oz jars",
			code_info: "Lot PB-123",
			report_date: "20260814",
			openfda: {
				brand_name: ["Example Pantry"],
				upc: ["00011110129505"],
			},
		});

		expect(alert).not.toBeNull();
		expect(alert?.identifiers).toEqual(expect.arrayContaining([
			expect.objectContaining({ type: "upc", normalizedValue: "00011110129505" }),
			expect.objectContaining({ type: "lot_code", normalizedValue: "PB-123" }),
		]));
		expect(alert?.isActive).toBe(true);
		expect(buildProbableSafetyAlertMatches(alert!, candidates)).toEqual([]);
	});

	it("queues strong brand, product, and package agreement for review", () => {
		const alert = normalizeOpenFdaAlert({
			recall_number: "F-0002-2026",
			status: "Ongoing",
			product_description: "Example Pantry Creamy Peanut Butter 16 oz jar",
			product_quantity: "16 oz jar",
			report_date: "20260814",
			openfda: { brand_name: ["Example Pantry"] },
		});

		expect(buildProbableSafetyAlertMatches(alert!, candidates)).toEqual([
			expect.objectContaining({
				sharedProductId: candidates[0].id,
				evidence: expect.objectContaining({
					matchBasis: "brand_product_package",
					requiresModeratorReview: true,
				}),
			}),
		]);
	});

	it("rejects weak title-only similarity and package disagreements", () => {
		const weakAlert = normalizeOpenFdaAlert({
			recall_number: "F-0003-2026",
			status: "Ongoing",
			product_description: "Peanut Butter",
			report_date: "20260814",
		});
		const wrongPackageAlert = normalizeOpenFdaAlert({
			recall_number: "F-0004-2026",
			status: "Ongoing",
			product_description: "Example Pantry Creamy Peanut Butter",
			product_quantity: "32 oz jar",
			report_date: "20260814",
			openfda: { brand_name: ["Example Pantry"] },
		});

		expect(buildProbableSafetyAlertMatches(weakAlert!, candidates)).toEqual([]);
		expect(buildProbableSafetyAlertMatches(wrongPackageAlert!, candidates)).toEqual([]);
	});

	it("normalizes FSIS records without claiming unprovided identifiers", () => {
		const alert = normalizeFsisAlert({
			Recall_Number: "023-2026",
			Product: "Ready-to-eat chicken salad",
			Company: "Example Kitchen",
			Class: "Class I",
			Status: "Active",
			Recall_Date: "2026-08-14",
			Code_Info: "Lot CHK-44",
		});

		expect(alert).toMatchObject({
			externalAlertId: "023-2026",
			alertType: "recall",
			classification: "Class I",
			isActive: true,
		});
		expect(alert?.identifiers).toEqual([
			expect.objectContaining({ type: "lot_code", normalizedValue: "CHK-44" }),
		]);
	});
});
