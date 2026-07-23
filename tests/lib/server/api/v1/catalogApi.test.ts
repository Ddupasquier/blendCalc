import { describe, expect, it } from "vitest";
import {
	createPagination,
	mapApprovedCatalogRecordToApiV1Product,
} from "$lib/server/api/v1/catalogApi.server";
import type { ApprovedCatalogRecord } from "$lib/server/products/catalogRead.server";

const record: ApprovedCatalogRecord = {
	id: "8dd47c75-17f7-4458-bb24-63cff946a716",
	barcode: "00021130493609",
	productName: "Roasted Onion & Garlic Pasta Sauce",
	brandOwner: "Safeway",
	category: {
		categoryOptionId: "sauces",
		label: "Sauces",
		sourceValue: "sauces",
		confidence: "exact",
	},
	canonicalProvenance: {},
	source: "community-reviewed",
	sourceReference: "submission-1",
	confidence: "moderator-reviewed",
	createdAt: "2026-07-18T10:00:00.000Z",
	updatedAt: "2026-07-19T10:00:00.000Z",
	lastVerifiedAt: "2026-07-19T11:00:00.000Z",
	revision: {
		id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
		number: 2,
		createdAt: "2026-07-19T10:00:00.000Z",
		labelObservedAt: "2026-07-17T10:00:00.000Z",
	},
	food: {
		fdcId: 123,
		description: "Roasted Onion & Garlic Pasta Sauce",
		ingredients: "Tomatoes, onion",
		allergens: [" Milk ", "Milk"],
		foodNutrients: [
			{
				nutrientId: 1003,
				nutrientName: "Protein",
				nutrientNumber: "203",
				unitName: "G",
				value: 0,
				valueOrigin: "reported",
				source: "usda",
				sourceReference: "123",
				confidence: "source-verified",
			},
			{
				nutrientId: 1008,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "KCAL",
				value: Number.NaN,
			},
		],
		foodServings: [{
			label: "1/2 cup",
			gramWeight: 125,
			amount: 0.5,
			unitKey: "cup",
			isPrimary: true,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
		}],
		fieldProvenance: {
			categories: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "imported",
			},
		},
	},
	images: [{
		source: "open-food-facts",
		sourceReference: "00021130493609",
		role: "front",
		imageUrl: "https://images.example/product.jpg",
		thumbnailUrl: "https://images.example/product-small.jpg",
		storagePath: "private/path-never-returned.jpg",
		licenseName: "CC BY-SA 3.0",
		licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
		attributionText: "Open Food Facts contributors",
		confidence: "source-verified",
		cropX: 60,
		cropY: 40,
		cropZoom: 1.5,
		fitMode: "custom",
		placementVersion: 2,
		approvedBy: "moderator-never-returned",
		approvedAt: "2026-07-19T10:00:00.000Z",
	}],
};

describe("blendCalc API v1 catalog mapping", () => {
	it("preserves real zeroes and represents unavailable values as null", () => {
		const product = mapApprovedCatalogRecordToApiV1Product(record);

		expect(product.nutrients[0]?.amountPer100g).toBe(0);
		expect(product.nutrients[1]?.amountPer100g).toBeNull();
		expect(product.nutrients[1]?.valueStatus).toBe("unknown");
		expect(product.nutrients[1]?.source).toBeNull();
		expect(product.servings[0]).toMatchObject({
			grams: 125,
			quantity: 0.5,
			unit: "cup",
			gramsPerUnit: 250,
		});
	});

	it("returns field sources, revision dates, and licensed images without private paths", () => {
		const product = mapApprovedCatalogRecordToApiV1Product(record, {
			usda: {
				source: "usda",
				displayName: "USDA FoodData Central",
				sourceUrl: "https://fdc.nal.usda.gov/",
				licenseName: "CC0-1.0",
				licenseUrl: "https://www.usa.gov/government-copyright",
				attribution: "USDA FoodData Central",
			},
			"open-food-facts": {
				source: "open-food-facts",
				displayName: "Open Food Facts",
				sourceUrl: "https://world.openfoodfacts.org/",
				licenseName: null,
				licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
				attribution: "Open Food Facts contributors",
			},
		});

		expect(product.fieldSources.category).toMatchObject({
			source: "open-food-facts",
			reference: "00021130493609",
		});
		expect(product.fieldSources.name).toBeNull();
		expect(product.fieldSources.brand).toBeNull();
		expect(product.fieldSources.ingredients).toBeNull();
		expect(product.revision).toMatchObject({ number: 2 });
		expect(product.images[0]).toMatchObject({
			license: {
				name: "CC BY-SA 3.0",
				attribution: "Open Food Facts contributors",
			},
		});
		expect(product.images[0]).not.toHaveProperty("storagePath");
		expect(product.images[0]).not.toHaveProperty("approvedBy");
		expect(product.sourceAttributions).toEqual([
			expect.objectContaining({
				source: "open-food-facts",
				attribution: "Open Food Facts contributors",
			}),
			expect.objectContaining({
				source: "usda",
				licenseName: "CC0-1.0",
			}),
		]);
	});

	it("creates predictable pagination", () => {
		expect(createPagination(15, 15, 31)).toEqual({
			limit: 15,
			offset: 15,
			total: 31,
			hasMore: true,
			nextOffset: 30,
		});
		expect(createPagination(15, 30, 31).nextOffset).toBeNull();
	});

	it.each([
		[
			"health-canada-cnf",
			"Health Canada Canadian Nutrient File",
			"Open Government Licence – Canada",
		],
		[
			"uk-cofid",
			"UK Composition of Foods Integrated Dataset",
			"Open Government Licence v3.0",
		],
	] as const)(
		"preserves %s attribution when its fields enter the canonical API",
		(sourceKey, displayName, licenseName) => {
			const attributedRecord = structuredClone(record);
			attributedRecord.food.foodNutrients[0].source = sourceKey;
			const product = mapApprovedCatalogRecordToApiV1Product(
				attributedRecord,
				{
					[sourceKey]: {
						source: sourceKey,
						displayName,
						sourceUrl: "https://example.com/dataset",
						licenseName,
						licenseUrl: "https://example.com/licence",
						attribution: "Required source attribution",
					},
				},
			);

			expect(product.sourceAttributions).toContainEqual({
				source: sourceKey,
				displayName,
				sourceUrl: "https://example.com/dataset",
				licenseName,
				licenseUrl: "https://example.com/licence",
				attribution: "Required source attribution",
			});
		},
	);
});
