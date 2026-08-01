import { describe, expect, it, vi } from "vitest";
import {
	createPagination,
	mapApprovedCatalogRecordToApiV1Product,
	readApiV1ProductRevisionHistory,
} from "$lib/server/api/v1/catalogApi.server";
import type { ApprovedCatalogRecord } from "$lib/server/products/catalogRead.server";

const usdaObservation = {
	observationId: "3f863f29-d720-43b6-aacd-3a9e1299cb94",
	observedAt: "2026-07-17T09:00:00.000Z",
	reviewState: "accepted" as const,
};
const openFoodFactsObservation = {
	observationId: "ef989ee2-7db8-48da-970f-1f3c778fac38",
	observedAt: "2026-07-17T09:30:00.000Z",
	reviewState: "accepted" as const,
};

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
			...usdaObservation,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		brandOwner: {
			...usdaObservation,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		ingredients: {
			...usdaObservation,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		categories: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		structuredIngredients: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		ingredientAnalysis: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		additives: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		allergens: {
			...usdaObservation,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		traces: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		labels: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		package: {
			...openFoodFactsObservation,
			source: "open-food-facts",
			sourceReference: "00021130493609",
			confidence: "imported",
			verificationMethod: "exact-barcode",
		},
		sourceMetadata: {
			...openFoodFactsObservation,
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
		precautionaryStatements: [{
			type: "shared_facility",
			text: "Made in a facility that also processes celery",
			allergens: ["celery"],
			languageCode: "en",
			sourceField: "ingredients",
			sourceReference: "123",
			observationId: "c09174bc-84a3-4c7b-9740-09dfe15a4f51",
			revisionId: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
			labelObservedAt: "2026-07-17T10:00:00.000Z",
		}],
		labels: ["Vegan"],
		packageQuantity: {
			label: "24 oz",
			amount: 24,
			unit: "oz",
		},
		sourceMetadata: {
			language: "en",
			languages: ["en:english"],
			marketCountries: ["United States"],
			revision: 4,
			publishedAt: "2026-07-01T00:00:00.000Z",
			availableAt: "2026-07-02T00:00:00.000Z",
			modifiedAt: "2026-07-03T00:00:00.000Z",
			discontinuedAt: "2026-07-04T00:00:00.000Z",
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
				valueStatus: "reported-zero",
				standardError: 0.2,
				sourceNutrientKey: "1003",
				sourceNutrientCode: "203",
				mappingStatus: "canonical",
				mappingMethod: "exact-source-key",
				mappingReviewReference: "internal-review-1003",
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
			measureType: "Package serving",
			isHouseholdMeasure: true,
			sourceMeasureKey: "serving_size",
			origin: "package-label",
			gramWeightMethod: "source-reported",
			calculationBasis: "Package reports 1/2 cup as 125g",
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
		rotationDegrees: 90,
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
		expect(product.nutrients[0]?.quality.sourceValueStatus).toBe("reported-zero");
		expect(product.nutrients[0]?.quality).toMatchObject({
			standardError: 0.2,
			sourceNutrientKey: "1003",
			sourceNutrientCode: "203",
			mappingStatus: "canonical",
			mappingMethod: "exact-source-key",
		});
		expect(product.nutrients[0]?.quality).not.toHaveProperty(
			"mappingReviewReference",
		);
		expect(product.nutrients[1]?.amountPer100g).toBeNull();
		expect(product.nutrients[1]?.valueStatus).toBe("unknown");
		expect(product.nutrients[1]?.source).toBeNull();
		expect(product.nutrients[1]?.quality).toMatchObject({
			mappingStatus: "unknown",
			standardError: null,
		});
		expect(product.servings[0]).toMatchObject({
			grams: 125,
			quantity: 0.5,
			unit: "cup",
			gramsPerUnit: 250,
			measureType: "Package serving",
			isHouseholdMeasure: true,
			sourceMeasureKey: "serving_size",
			origin: "package-label",
			gramWeightMethod: "source-reported",
			calculationBasis: "Package reports 1/2 cup as 125g",
		});
		expect(product.compatibilityEvaluation).toMatchObject({
			version: 1,
			status: "not_checked",
			policyVersion: null,
			profileApplied: false,
			conflictCount: 0,
		});
		expect(product.compatibilityEvaluation).not.toHaveProperty("regulatoryContext");
		expect(product.compatibilityEvaluation).not.toHaveProperty("preferenceResolution");
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
			observationId: openFoodFactsObservation.observationId,
			source: "open-food-facts",
			reference: "00021130493609",
			observedAt: openFoodFactsObservation.observedAt,
			verificationMethod: "exact-barcode",
			reviewState: "accepted",
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
				precautionaryStatements: [{
					type: "shared_facility",
					text: "Made in a facility that also processes celery",
					allergens: ["celery"],
					observationId: "c09174bc-84a3-4c7b-9740-09dfe15a4f51",
					revisionId: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
				}],
			labels: ["Vegan"],
		});
		expect(product.packageQuantity).toEqual({
			label: "24 oz",
			amount: 24,
			unit: "oz",
		});
		expect(product.sourceRecord).toMatchObject({
			language: "en",
			languages: ["en:english"],
			marketCountries: ["United States"],
			revision: 4,
			publishedAt: "2026-07-01T00:00:00.000Z",
			availableAt: "2026-07-02T00:00:00.000Z",
			modifiedAt: "2026-07-03T00:00:00.000Z",
			discontinuedAt: "2026-07-04T00:00:00.000Z",
			completeness: 0.92,
			tagSources: { allergens: ["ingredients", "packaging"] },
		});
		expect(product.fieldSources.structuredIngredients).toMatchObject({
			source: "open-food-facts",
		});
		expect(JSON.stringify(product.fieldSources)).not.toContain("rawPayload");
		expect(JSON.stringify(product.fieldSources)).not.toContain("submittedBy");
		expect(JSON.stringify(product.fieldSources)).not.toContain("evidencePath");
		expect(product.revision).toMatchObject({ number: 2 });
		expect(product.revision).toMatchObject({
			currentSince: "2026-07-17T10:00:00.000Z",
			currentSinceBasis: "blendcalc-observed",
			labelObservedAt: "2026-07-17T10:00:00.000Z",
		});
		expect(product.images[0]).toMatchObject({
			license: {
				name: "CC BY-SA 3.0",
				attribution: "Open Food Facts contributors",
			},
			placement: {
				rotationDegrees: 90,
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

	it("maps structured revision changes without exposing revision snapshots", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: [{
				id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
				revision_number: 2,
				published_at: "2026-07-19T10:00:00.000Z",
				label_observed_at: "2026-07-17T10:00:00.000Z",
				changes: [{
					field: "ingredients",
					label: "Ingredient statement",
					changeType: "changed",
					previousValue: "Tomatoes",
					newValue: "Tomatoes, onion",
					severity: "medium",
				}],
				total_count: 2,
			}],
			error: null,
		});

		const result = await readApiV1ProductRevisionHistory(
			{ rpc } as never,
			"00021130493609",
			{ limit: 25, offset: 0 },
		);

		expect(result).toEqual({
			revisions: [{
				id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
				number: 2,
				publishedAt: "2026-07-19T10:00:00.000Z",
				labelObservedAt: "2026-07-17T10:00:00.000Z",
				changes: [{
					field: "ingredients",
					label: "Ingredient statement",
					changeType: "changed",
					previousValue: "Tomatoes",
					newValue: "Tomatoes, onion",
					severity: "medium",
				}],
			}],
			pagination: {
				limit: 25,
				offset: 0,
				total: 2,
				hasMore: false,
				nextOffset: null,
			},
		});
		expect(result?.revisions[0]).not.toHaveProperty("food");
		expect(result?.revisions[0]).not.toHaveProperty("evidencePaths");
	});

	it("returns an empty page instead of a false not-found result", async () => {
		const rpc = vi.fn()
			.mockResolvedValueOnce({ data: [], error: null })
			.mockResolvedValueOnce({
				data: [{
					id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
					revision_number: 2,
					published_at: "2026-07-19T10:00:00.000Z",
					label_observed_at: "2026-07-17T10:00:00.000Z",
					changes: [],
					total_count: 2,
				}],
				error: null,
			});

		const result = await readApiV1ProductRevisionHistory(
			{ rpc } as never,
			"00021130493609",
			{ limit: 25, offset: 100 },
		);

		expect(result).toEqual({
			revisions: [],
			pagination: {
				limit: 25,
				offset: 100,
				total: 2,
				hasMore: false,
				nextOffset: null,
			},
		});
		expect(rpc).toHaveBeenNthCalledWith(
			2,
			"get_blendcalc_product_revision_history_v1",
			{ p_barcode: "00021130493609", p_limit: 1, p_offset: 0 },
		);
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
