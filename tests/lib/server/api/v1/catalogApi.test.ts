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
		updatedAt: "2026-07-18T10:00:00.000Z",
	},
	canonicalProvenance: {},
	fieldProvenance: {
		productName: {
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		brandOwner: {
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		ingredients: {
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		categories: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		structuredIngredients: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		ingredientAnalysis: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		additives: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		allergens: {
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		traces: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		labels: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		package: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		sourceMetadata: {
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
	},
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
		ingredientList: ["Tomatoes", "Onion"],
		structuredIngredients: [{
			id: "en:tomato",
			text: "Tomatoes",
			percentEstimate: 80,
		}],
		ingredientAnalysis: {
			ingredientTags: ["tomato", "onion"],
			analysisTags: ["vegan"],
			derivedTraceTags: ["celery"],
			percentEstimate: 92,
		},
		additives: ["e330"],
		allergens: [" Milk ", "Milk"],
		traces: ["Celery"],
		labels: ["Vegan"],
		packageQuantity: {
			label: "24 oz",
			amount: 24,
			unit: "oz",
		},
		sourceMetadata: {
			language: "en",
			revision: 4,
			completeness: 0.92,
			tagSources: { allergens: ["ingredients", "packaging"] },
		},
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
			structuredIngredients: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
			},
			ingredientAnalysis: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
			},
			additives: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
			},
			traces: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
			},
			labels: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
			},
			package: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
			},
			sourceMetadata: {
				source: "open-food-facts",
				sourceReference: "00021130493609",
				confidence: "unknown",
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
		expect(product.fieldSources.name).toMatchObject({
			source: "usda",
			reference: "123",
		});
		expect(product.fieldSources.brand).toMatchObject({
			source: "usda",
			reference: "123",
		});
		expect(product.fieldSources.ingredients).toMatchObject({
			source: "usda",
			reference: "123",
		});
		expect(product.ingredients).toMatchObject({
			items: ["Tomatoes", "Onion"],
			structured: [{
				id: "en:tomato",
				text: "Tomatoes",
				percentEstimate: 80,
			}],
			analysis: {
				percentEstimate: 92,
				derivedTraceTags: ["celery"],
			},
			additives: ["e330"],
			traces: ["Celery"],
			labels: ["Vegan"],
		});
		expect(product.packageQuantity).toEqual({
			label: "24 oz",
			amount: 24,
			unit: "oz",
		});
		expect(product.sourceRecord).toMatchObject({
			language: "en",
			revision: 4,
			completeness: 0.92,
			tagSources: { allergens: ["ingredients", "packaging"] },
		});
		expect(product.fieldSources.structuredIngredients).toMatchObject({
			source: "open-food-facts",
		});
		expect(product.revision).toMatchObject({ number: 2 });
		expect(product.images[0]).toMatchObject({
			license: {
				name: "CC BY-SA 3.0",
				attribution: "Open Food Facts contributors",
			},
		});
		expect(product.images[0]).not.toHaveProperty("storagePath");
		expect(product.images[0]).not.toHaveProperty("approvedBy");
		expect(product.catalog).toEqual({
			authority: "blendcalc-shared-catalog",
			status: "active",
			verification: "moderator-reviewed",
			redistributionPolicy: "approved",
			sourceCount: 2,
		});
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

	it("keeps image licensing separate from product-field attribution", () => {
		const imageOnlyRecord = structuredClone(record);
		imageOnlyRecord.source = "usda";
		imageOnlyRecord.food.fieldProvenance = {};
		imageOnlyRecord.fieldProvenance = {
			productName: record.fieldProvenance.productName,
			brandOwner: record.fieldProvenance.brandOwner,
			ingredients: record.fieldProvenance.ingredients,
		};
		const product = mapApprovedCatalogRecordToApiV1Product(imageOnlyRecord, {
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
				licenseName: "ODbL-1.0",
				licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
				attribution: "Open Food Facts contributors",
			},
		});

		expect(product.images).toHaveLength(1);
		expect(product.sourceAttributions.map((source) => source.source)).toEqual([
			"usda",
		]);
	});

	it("does not publish legacy JSON provenance as canonical field lineage", () => {
		const legacyRecord = structuredClone(record);
		legacyRecord.fieldProvenance = {
			productName: record.fieldProvenance.productName,
			brandOwner: record.fieldProvenance.brandOwner,
			ingredients: record.fieldProvenance.ingredients,
		};
		const product = mapApprovedCatalogRecordToApiV1Product(legacyRecord, {
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
				licenseName: "ODbL-1.0",
				licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
				attribution: "Open Food Facts contributors",
			},
		});

		expect(product.fieldSources.category).toBeNull();
		expect(product.fieldSources.structuredIngredients).toBeNull();
		expect(product.sourceAttributions.map((source) => source.source)).toEqual([
			"usda",
		]);
	});

	it("withholds images that lack complete asset-level rights metadata", () => {
		const incompleteImageRecord = structuredClone(record);
		delete incompleteImageRecord.images[0].attributionText;

		const product = mapApprovedCatalogRecordToApiV1Product(
			incompleteImageRecord,
		);

		expect(product.images).toEqual([]);
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
