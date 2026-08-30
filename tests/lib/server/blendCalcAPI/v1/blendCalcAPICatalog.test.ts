import { describe, expect, it, vi } from "vitest";
import {
	createPagination,
	mapBlendCalcAPIV1SourceAttributionCatalog,
	mapApprovedCatalogRecordToBlendCalcAPIV1Product,
	readBlendCalcAPIV1Categories,
	readBlendCalcAPIV1ProductRevisionHistory,
	type BlendCalcAPIV1SourceAttributionCatalog,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server";
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

const sourceAttribution = (
	source: string,
	displayName: string,
	licenseName: string,
) => ({
	source,
	displayName,
	sourceUrl: `https://example.com/${source}`,
	licenseName,
	licenseUrl: `https://example.com/${source}/license`,
	attribution: `${displayName} attribution`,
	redistributionPolicyReviewedAt: "2026-07-22T00:00:00.000Z",
	dataset: null,
});

const attributionCatalog = (
	sources: BlendCalcAPIV1SourceAttributionCatalog["sources"],
	datasetsBySource: BlendCalcAPIV1SourceAttributionCatalog["datasetsBySource"] = {},
	assetSources: BlendCalcAPIV1SourceAttributionCatalog["assetSources"] = Object.fromEntries(
		Object.entries(sources).map(([key, source]) => [
			key,
			{ displayName: source.displayName, sourceUrl: source.sourceUrl },
		]),
	),
): BlendCalcAPIV1SourceAttributionCatalog => ({
	sources,
	datasetsBySource,
	datasetSourceKeys: new Set(Object.keys(datasetsBySource)),
	assetSources,
});

const defaultAttributionCatalog = () =>
	attributionCatalog({
		usda: sourceAttribution("usda", "USDA FoodData Central", "CC0-1.0"),
		"open-food-facts": sourceAttribution(
			"open-food-facts",
			"Open Food Facts",
			"ODbL-1.0",
		),
		"shared-catalog": sourceAttribution(
			"shared-catalog",
			"blendCalc Shared Catalog",
			"blendCalc submission terms",
		),
	});

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
		alcoholByVolume: {
			...usdaObservation,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
			verificationMethod: "exact-barcode",
		},
		regulatoryDisclosure: {
			...usdaObservation,
			source: "usda",
			sourceReference: "123",
			confidence: "source-verified",
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
		structuredIngredients: [
			{
				id: "en:tomato",
				text: "Tomatoes",
				percentEstimate: 80,
			},
		],
		ingredientAnalysis: {
			ingredientTags: ["tomato", "onion"],
			analysisTags: ["vegan"],
			derivedTraceTags: ["celery"],
			percentEstimate: 92,
		},
		additives: ["e330"],
		allergens: [" Milk ", "Milk"],
		traces: ["Celery"],
		precautionaryStatements: [
			{
				type: "shared_facility",
				text: "Made in a facility that also processes celery",
				allergens: ["celery"],
				languageCode: "en",
				sourceField: "ingredients",
				sourceReference: "123",
				observationId: "c09174bc-84a3-4c7b-9740-09dfe15a4f51",
				revisionId: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
				labelObservedAt: "2026-07-17T10:00:00.000Z",
			},
		],
		labels: ["Vegan"],
		packageQuantity: {
			label: "24 oz",
			amount: 24,
			unit: "oz",
		},
		alcoholByVolume: {
			percent: 6.5,
			valueStatus: "reported",
			basis: "volume-percent",
			sourceUnit: "% ABV",
		},
		regulatoryDisclosure: {
			profileKey: "us-ttb-alcohol-beverage-v1",
			evidenceStatus: "moderator-reviewed",
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
			{
				nutrientId: 1087,
				nutrientName: "Calcium",
				nutrientNumber: "301",
				unitName: "MG",
				value: 18,
				valueOrigin: "estimated",
				valueStatus: "estimated",
				valueQualifier: "source-estimate",
				source: "usda",
				sourceReference: "123",
				confidence: "source-verified",
			},
		],
		foodServings: [
			{
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
			},
		],
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
	images: [
		{
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
			canonicalStatus: "selected",
			canonicalSelectionMethod: "exact-licensed-source",
			canonicalSelectedAt: "2026-07-17T09:30:00.000Z",
			cropX: 60,
			cropY: 40,
			cropZoom: 1.5,
			rotationDegrees: 90,
			fitMode: "custom",
			placementVersion: 2,
			approvedBy: "moderator-never-returned",
			approvedAt: "2026-07-19T10:00:00.000Z",
			fetchedAt: "2026-07-17T09:30:00.000Z",
		},
	],
};

describe("blendCalcAPI v1 catalog mapping", () => {
	it("preserves real zeroes and represents unavailable values as null", () => {
		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			record,
			defaultAttributionCatalog(),
		);

		expect(product.nutrients[0]?.amountPer100g).toBe(0);
		expect(product.nutrients[0]?.quality.sourceValueStatus).toBe(
			"reported-zero",
		);
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
		expect(product.nutrients[2]).toMatchObject({
			amountPer100g: 18,
			valueStatus: "estimated",
			quality: {
				sourceValueStatus: "estimated",
				valueQualifier: "source-estimate",
			},
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
		expect(product.compatibilityEvaluation).not.toHaveProperty(
			"regulatoryContext",
		);
		expect(product.compatibilityEvaluation).not.toHaveProperty(
			"preferenceResolution",
		);
	});

	it("derives API per-100-gram values only from exact package-serving mass", () => {
		const packageServingRecord = structuredClone(record);
		packageServingRecord.food.foodNutrients = [
			{
				nutrientId: 1008,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "KCAL",
				value: 80,
				valueOrigin: "reported",
				valueStatus: "reported",
				standardError: 3,
				measurementBasis: {
					kind: "serving",
					quantity: 1,
					unitKey: "serving",
					servingLabel: "1 cookie",
				},
				source: "usda",
				sourceReference: "123",
				confidence: "source-verified",
			},
		];
		packageServingRecord.food.foodServings = [
			{
				label: "1 cookie (30g)",
				gramWeight: 30,
				amount: 1,
				unitKey: "item",
				isPrimary: true,
				origin: "package-label",
				gramWeightMethod: "source-reported",
				source: "usda",
				sourceReference: "123",
				confidence: "source-verified",
			},
		];

		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			packageServingRecord,
			defaultAttributionCatalog(),
		);

		expect(product.nutrients[0]?.amountPer100g).toBeCloseTo(266.6667, 4);
		expect(product.nutrients[0]?.valueStatus).toBe("derived");
		expect(product.nutrients[0]?.quality).toMatchObject({
			sourceValueStatus: "reported",
			standardError: 10,
			derivationMethod: "exact-native-basis-to-100g",
		});
		expect(product.servings[0]).toMatchObject({
			label: "1 cookie (30g)",
			grams: 30,
			gramWeightMethod: "source-reported",
		});

		packageServingRecord.food.foodServings[0]!.gramWeightMethod = "unknown";
		const productWithoutExactMass =
			mapApprovedCatalogRecordToBlendCalcAPIV1Product(
				packageServingRecord,
				defaultAttributionCatalog(),
			);

		expect(productWithoutExactMass.nutrients[0]?.amountPer100g).toBeNull();
	});

	it("returns field sources, revision dates, and licensed images without private paths", () => {
		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			record,
			attributionCatalog({
				usda: sourceAttribution("usda", "USDA FoodData Central", "CC0-1.0"),
				"open-food-facts": sourceAttribution(
					"open-food-facts",
					"Open Food Facts",
					"ODbL-1.0",
				),
			}),
		);

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
			structured: [
				{
					id: "en:tomato",
					text: "Tomatoes",
					percentEstimate: 80,
				},
			],
			analysis: {
				percentEstimate: 92,
				derivedTraceTags: ["celery"],
			},
			additives: ["e330"],
			traces: ["Celery"],
			precautionaryStatements: [
				{
					type: "shared_facility",
					text: "Made in a facility that also processes celery",
					allergens: ["celery"],
					observationId: "c09174bc-84a3-4c7b-9740-09dfe15a4f51",
					revisionId: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
				},
			],
			labels: ["Vegan"],
		});
		expect(product.packageQuantity).toEqual({
			label: "24 oz",
			amount: 24,
			unit: "oz",
		});
		expect(product.alcoholByVolume).toEqual({
			percent: 6.5,
			valueStatus: "reported",
			basis: "volume-percent",
			sourceUnit: "% ABV",
		});
		expect(product.regulatoryDisclosure).toEqual({
			profileKey: "us-ttb-alcohol-beverage-v1",
			evidenceStatus: "moderator-reviewed",
		});
		expect(product.fieldSources.alcoholByVolume).toMatchObject({
			source: "usda",
			reference: "123",
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
			sourceName: "Open Food Facts",
			sourceUrl: "https://example.com/open-food-facts",
			license: {
				name: "CC BY-SA 3.0",
				attribution: "Open Food Facts contributors",
			},
			placement: {
				rotationDegrees: 90,
			},
			retrievedAt: "2026-07-17T09:30:00.000Z",
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
				attribution: "Open Food Facts attribution",
			}),
			expect.objectContaining({
				source: "usda",
				licenseName: "CC0-1.0",
			}),
		]);
	});

	it("publishes active official safety notices without private match evidence", () => {
		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			{
				...record,
				food: {
					...record.food,
					safetyAlerts: [
						{
							id: "f7e73167-d6eb-4753-921c-b2a799029e53",
							providerKey: "open-fda-food-enforcement",
							sourceName: "openFDA Food Enforcement",
							sourceAttribution: "U.S. Food and Drug Administration",
							alertType: "recall",
							classification: "Class I",
							status: "Ongoing",
							productDescription: "Example product",
							reason: "Possible undeclared milk",
							recallingOrganization: "Example Foods",
							packageDescription: "16 oz jar",
							codeInformation: "Lot PB-123",
							sourceUrl: "https://api.fda.gov/food/enforcement.json",
							reportDate: "2026-08-14",
							recallInitiatedAt: "2026-08-13",
							matchType: "exact_gtin",
							requiresPackageCheck: true,
							detectedAt: "2026-08-14T12:00:00.000Z",
						},
					],
				},
			},
			defaultAttributionCatalog(),
		);

		expect(product.safetyAlerts).toEqual([
			{
				id: "f7e73167-d6eb-4753-921c-b2a799029e53",
				type: "recall",
				classification: "Class I",
				status: "Ongoing",
				productDescription: "Example product",
				reason: "Possible undeclared milk",
				recallingOrganization: "Example Foods",
				packageDescription: "16 oz jar",
				codeInformation: "Lot PB-123",
				requiresPackageCheck: true,
				reportDate: "2026-08-14",
				recallInitiatedAt: "2026-08-13",
				source: {
					key: "open-fda-food-enforcement",
					name: "openFDA Food Enforcement",
					url: "https://api.fda.gov/food/enforcement.json",
					attribution: "U.S. Food and Drug Administration",
				},
			},
		]);
		expect(product.safetyAlerts[0]).not.toHaveProperty("matchType");
		expect(product.safetyAlerts[0]).not.toHaveProperty("detectedAt");
	});

	it("strips hostile private fields, paths, secrets, and package-instance data", () => {
		const privateSentinel = "PRIVATE-SENTINEL-DO-NOT-PUBLISH";
		const hostileRecord = structuredClone(record) as ApprovedCatalogRecord &
			Record<string, unknown>;
		Object.assign(hostileRecord, {
			submittedBy: privateSentinel,
			reviewedBy: privateSentinel,
			moderationEvidence: privateSentinel,
		});
		Object.assign(hostileRecord.food, {
			userId: privateSentinel,
			ownerId: privateSentinel,
			privateLabel: privateSentinel,
			packageInstance: {
				lotCode: privateSentinel,
				serialNumber: privateSentinel,
				expirationDate: privateSentinel,
			},
		});
		hostileRecord.source = "community-reviewed";
		hostileRecord.sourceReference = `private/submissions/${privateSentinel}`;
		hostileRecord.fieldProvenance.productName = {
			...hostileRecord.fieldProvenance.productName!,
			source: "community-reviewed",
			sourceReference: `private/evidence/${privateSentinel}`,
		};
		hostileRecord.food.precautionaryStatements![0].sourceReference = `private/evidence/${privateSentinel}`;
		hostileRecord.food.sourceMetadata!.tagSources = {
			allergens: [
				"ingredients",
				`private/evidence/${privateSentinel}`,
				`token=${privateSentinel}`,
			],
			privateEvidence: [privateSentinel],
		};
		Object.assign(hostileRecord.images[0], {
			storagePath: `private/${privateSentinel}.jpg`,
			approvedBy: privateSentinel,
		});

		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			hostileRecord,
			defaultAttributionCatalog(),
		);
		const serialized = JSON.stringify(product);

		expect(product.fieldSources.name?.reference).toBeNull();
		expect(
			product.ingredients.precautionaryStatements[0]?.sourceReference,
		).toBeNull();
		expect(product.sourceRecord?.tagSources).toEqual({
			allergens: ["ingredients"],
		});
		expect(serialized).not.toContain(privateSentinel);
		for (const privateField of [
			"submittedBy",
			"reviewedBy",
			"userId",
			"ownerId",
			"privateLabel",
			"packageInstance",
			"lotCode",
			"serialNumber",
			"expirationDate",
			"storagePath",
			"approvedBy",
			"privateEvidence",
		]) {
			expect(serialized).not.toContain(`"${privateField}"`);
		}
	});

	it("publishes only the category contract when database rows contain private fields", async () => {
		const privateSentinel = "PRIVATE-CATEGORY-SENTINEL";
		const range = vi.fn().mockResolvedValue({
			data: [
				{
					id: "sauces",
					label: "Sauces",
					normalized_value: "sauces",
					updated_at: "2026-07-19T10:00:00.000Z",
					owner_id: privateSentinel,
					reviewed_by: privateSentinel,
				},
			],
			error: null,
			count: 1,
		});
		const secondOrder = vi.fn().mockReturnValue({ range });
		const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
		const eq = vi.fn().mockReturnValue({ order: firstOrder });
		const select = vi.fn().mockReturnValue({ eq });
		const from = vi.fn().mockReturnValue({ select });

		const result = await readBlendCalcAPIV1Categories({ from } as never, {
			limit: 25,
			offset: 0,
		});

		expect(result).toEqual({
			categories: [
				{
					id: "sauces",
					name: "Sauces",
					slug: "sauces",
					updatedAt: "2026-07-19T10:00:00.000Z",
				},
			],
			pagination: {
				limit: 25,
				offset: 0,
				total: 1,
				hasMore: false,
				nextOffset: null,
			},
		});
		expect(JSON.stringify(result)).not.toContain(privateSentinel);
		expect(select).toHaveBeenCalledWith(
			"id, label, normalized_value, updated_at",
			{ count: "exact" },
		);
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
		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			imageOnlyRecord,
			attributionCatalog(
				{
					usda: sourceAttribution("usda", "USDA FoodData Central", "CC0-1.0"),
				},
				{},
				{
					"open-food-facts": {
						displayName: "Open Food Facts",
						sourceUrl: "https://world.openfoodfacts.org",
					},
				},
			),
		);

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
		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			legacyRecord,
			attributionCatalog({
				usda: sourceAttribution("usda", "USDA FoodData Central", "CC0-1.0"),
			}),
		);

		expect(product.fieldSources.category).toBeNull();
		expect(product.fieldSources.structuredIngredients).toBeNull();
		expect(product.sourceAttributions.map((source) => source.source)).toEqual([
			"usda",
		]);
	});

	it.each([
		["license URL", "licenseUrl"],
		["attribution credit", "attributionText"],
		["retrieval date", "fetchedAt"],
	] as const)(
		"withholds images that lack their asset-level %s",
		(_description, field) => {
			const incompleteImageRecord = structuredClone(record);
			delete incompleteImageRecord.images[0][field];

			const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
				incompleteImageRecord,
				defaultAttributionCatalog(),
			);

			expect(product.images).toEqual([]);
		},
	);

	it("withholds alternate front-image candidates", () => {
		const alternateImageRecord = structuredClone(record);
		alternateImageRecord.images[0].canonicalStatus = "candidate";
		delete alternateImageRecord.images[0].canonicalSelectionMethod;
		delete alternateImageRecord.images[0].canonicalSelectedAt;

		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			alternateImageRecord,
			defaultAttributionCatalog(),
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

	it("traverses bounded pages without duplicates or skipped records", () => {
		const total = 31;
		const limit = 15;
		const visitedIndexes: number[] = [];
		let offset = 0;

		while (offset < total) {
			const pagination = createPagination(limit, offset, total);
			visitedIndexes.push(
				...Array.from(
					{ length: Math.min(limit, total - offset) },
					(_, index) => offset + index,
				),
			);
			if (pagination.nextOffset === null) break;
			offset = pagination.nextOffset;
		}

		expect(visitedIndexes).toEqual(
			Array.from({ length: total }, (_, index) => index),
		);
		expect(new Set(visitedIndexes).size).toBe(total);
		expect(createPagination(limit, total + 10, total)).toEqual({
			limit,
			offset: total + 10,
			total,
			hasMore: false,
			nextOffset: null,
		});
	});

	it("maps structured revision changes without exposing revision snapshots", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: [
				{
					id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
					revision_number: 2,
					published_at: "2026-07-19T10:00:00.000Z",
					label_observed_at: "2026-07-17T10:00:00.000Z",
					changes: [
						{
							field: "ingredients",
							label: "Ingredients",
							changeType: "changed",
							previousValue: "Tomatoes",
							newValue: "Tomatoes, onion",
							severity: "medium",
						},
					],
					total_count: 2,
				},
			],
			error: null,
		});

		const result = await readBlendCalcAPIV1ProductRevisionHistory(
			{ rpc } as never,
			"00021130493609",
			{ limit: 25, offset: 0 },
		);

		expect(result).toEqual({
			revisions: [
				{
					id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
					number: 2,
					publishedAt: "2026-07-19T10:00:00.000Z",
					labelObservedAt: "2026-07-17T10:00:00.000Z",
					changes: [
						{
							field: "ingredients",
							label: "Ingredients",
							changeType: "changed",
							previousValue: "Tomatoes",
							newValue: "Tomatoes, onion",
							severity: "medium",
						},
					],
				},
			],
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

	it("publishes only allowlisted revision fields, labels, and value shapes", async () => {
		const privateSentinel = "PRIVATE-REVISION-SENTINEL";
		const rpc = vi.fn().mockResolvedValue({
			data: [
				{
					id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
					revision_number: 3,
					published_at: "2026-07-20T10:00:00.000Z",
					label_observed_at: "2026-07-20T09:00:00.000Z",
					changes: [
						{
							field: "ingredients",
							label: privateSentinel,
							changeType: "changed",
							previousValue: "Tomatoes",
							newValue: "Tomatoes, onion",
							severity: "medium",
						},
						{
							field: "nutrient:1003",
							label: privateSentinel,
							changeType: "changed",
							previousValue: {
								value: 2,
								unit: "g",
								evidencePath: privateSentinel,
							},
							newValue: { value: 3, unit: "g", reviewedBy: privateSentinel },
							severity: "low",
						},
						{
							field: "moderatorEvidence",
							label: privateSentinel,
							changeType: "added",
							previousValue: null,
							newValue: { path: privateSentinel },
							severity: "high",
						},
					],
					total_count: 1,
				},
			],
			error: null,
		});

		const result = await readBlendCalcAPIV1ProductRevisionHistory(
			{ rpc } as never,
			"00021130493609",
			{ limit: 25, offset: 0 },
		);

		expect(result?.revisions[0]?.changes).toEqual([
			{
				field: "ingredients",
				label: "Ingredients",
				changeType: "changed",
				previousValue: "Tomatoes",
				newValue: "Tomatoes, onion",
				severity: "medium",
			},
			{
				field: "nutrient:1003",
				label: "Nutrient 1003",
				changeType: "changed",
				previousValue: { value: 2, unit: "g" },
				newValue: { value: 3, unit: "g" },
				severity: "low",
			},
		]);
		expect(JSON.stringify(result)).not.toContain(privateSentinel);
	});

	it("returns an empty page instead of a false not-found result", async () => {
		const rpc = vi
			.fn()
			.mockResolvedValueOnce({ data: [], error: null })
			.mockResolvedValueOnce({
				data: [
					{
						id: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
						revision_number: 2,
						published_at: "2026-07-19T10:00:00.000Z",
						label_observed_at: "2026-07-17T10:00:00.000Z",
						changes: [],
						total_count: 2,
					},
				],
				error: null,
			});

		const result = await readBlendCalcAPIV1ProductRevisionHistory(
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
			"get_blendcalc_api_product_revision_history_v1",
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
		"preserves release-specific %s attribution when its fields enter the canonical API",
		(sourceKey, displayName, licenseName) => {
			const attributedRecord = structuredClone(record);
			const datasetKey =
				sourceKey === "health-canada-cnf" ? "cnf-2026" : "cofid-2021";
			for (const fieldSource of Object.values(
				attributedRecord.fieldProvenance,
			)) {
				fieldSource.source = sourceKey;
				fieldSource.sourceReference = `${datasetKey}:101`;
			}
			for (const nutrient of attributedRecord.food.foodNutrients) {
				nutrient.source = sourceKey;
				nutrient.sourceReference = `${datasetKey}:101`;
			}
			for (const serving of attributedRecord.food.foodServings ?? []) {
				serving.source = sourceKey;
				serving.sourceReference = `${datasetKey}:101`;
			}
			const providerAttribution = sourceAttribution(
				sourceKey,
				displayName,
				licenseName,
			);
			const datasetAttribution = {
				...providerAttribution,
				sourceUrl: "https://example.com/dataset",
				licenseUrl: "https://example.com/licence",
				attribution: "Required source attribution",
				dataset: {
					key: datasetKey,
					name: `${displayName} 2026`,
					version: datasetKey.endsWith("2026") ? "2026" : "2021",
					importedAt: "2026-07-26T00:00:00.000Z",
				},
			};
			const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
				attributedRecord,
				attributionCatalog(
					{ [sourceKey]: providerAttribution },
					{ [sourceKey]: { [datasetKey]: datasetAttribution } },
				),
			);

			expect(product.sourceAttributions).toContainEqual(datasetAttribution);
		},
	);

	it("fails closed when represented source attribution is unavailable", () => {
		expect(() =>
			mapApprovedCatalogRecordToBlendCalcAPIV1Product(
				record,
				attributionCatalog({}),
			),
		).toThrow("Required API source attribution is unavailable.");
	});

	it("fails closed when a product has no canonical source lineage", () => {
		const unattributedRecord = structuredClone(record);
		unattributedRecord.fieldProvenance = {};
		unattributedRecord.food.foodNutrients = [];
		unattributedRecord.food.foodServings = [];

		expect(() =>
			mapApprovedCatalogRecordToBlendCalcAPIV1Product(
				unattributedRecord,
				defaultAttributionCatalog(),
			),
		).toThrow("Required API source attribution is unavailable.");
	});

	it("builds a complete provider and release attribution catalog", () => {
		const catalog = mapBlendCalcAPIV1SourceAttributionCatalog(
			[
				{
					key: "health-canada-cnf",
					display_name: "Health Canada Canadian Nutrient File",
					homepage_url: "https://example.com/cnf",
					terms_url: "https://example.com/cnf/license",
					attribution_text: "Required Canada attribution",
					canonical_license_name: "Open Government Licence – Canada",
					canonical_policy_reviewed_at: "2026-07-22T00:00:00.000Z",
					canonical_storage_allowed: true,
					api_redistribution_allowed: true,
				},
			],
			[
				{
					key: "cnf-2026",
					source_key: "health-canada-cnf",
					display_name: "Canadian Nutrient File 2026",
					version: "2026",
					source_url: "https://example.com/cnf-2026",
					license_name: "Open Government Licence – Canada",
					license_url: "https://example.com/cnf/license",
					attribution_text: "Contains information licensed by Canada.",
					imported_at: "2026-07-26T00:00:00.000Z",
					active: true,
					import_enabled: true,
					license_review_status: "approved",
				},
			],
		);

		expect(catalog.sources["health-canada-cnf"]).toMatchObject({
			licenseName: "Open Government Licence – Canada",
			redistributionPolicyReviewedAt: "2026-07-22T00:00:00.000Z",
		});
		expect(
			catalog.datasetsBySource["health-canada-cnf"]?.["cnf-2026"],
		).toMatchObject({
			dataset: {
				key: "cnf-2026",
				version: "2026",
				importedAt: "2026-07-26T00:00:00.000Z",
			},
		});
	});

	it("withholds an approved dataset whose import date is missing", () => {
		const catalog = mapBlendCalcAPIV1SourceAttributionCatalog(
			[
				{
					key: "health-canada-cnf",
					display_name: "Health Canada Canadian Nutrient File",
					homepage_url: "https://example.com/cnf",
					terms_url: "https://example.com/cnf/license",
					attribution_text: "Required Canada attribution",
					canonical_license_name: "Open Government Licence – Canada",
					canonical_policy_reviewed_at: "2026-07-22T00:00:00.000Z",
					canonical_storage_allowed: true,
					api_redistribution_allowed: true,
				},
			],
			[
				{
					key: "cnf-2026",
					source_key: "health-canada-cnf",
					display_name: "Canadian Nutrient File 2026",
					version: "2026",
					source_url: "https://example.com/cnf-2026",
					license_name: "Open Government Licence – Canada",
					license_url: "https://example.com/cnf/license",
					attribution_text: "Contains information licensed by Canada.",
					imported_at: null,
					active: true,
					import_enabled: true,
					license_review_status: "approved",
				},
			],
		);

		expect(catalog.datasetsBySource["health-canada-cnf"]).toBeUndefined();
		expect(catalog.datasetSourceKeys.has("health-canada-cnf")).toBe(true);
	});

	it("withholds an API-approved source whose legal attribution is incomplete", () => {
		const catalog = mapBlendCalcAPIV1SourceAttributionCatalog(
			[
				{
					key: "incomplete-source",
					display_name: "Incomplete source",
					homepage_url: "https://example.com/incomplete",
					terms_url: null,
					attribution_text: "Required credit",
					canonical_license_name: "Example licence",
					canonical_policy_reviewed_at: "2026-07-22T00:00:00.000Z",
					canonical_storage_allowed: true,
					api_redistribution_allowed: true,
				},
			],
			[],
		);

		expect(catalog.sources["incomplete-source"]).toBeUndefined();
	});

	it("fails closed when a represented dataset release cannot be resolved", () => {
		const attributedRecord = structuredClone(record);
		for (const fieldSource of Object.values(attributedRecord.fieldProvenance)) {
			fieldSource.source = "health-canada-cnf";
			fieldSource.sourceReference = "cnf-2026:101";
		}
		for (const nutrient of attributedRecord.food.foodNutrients) {
			nutrient.source = "health-canada-cnf";
			nutrient.sourceReference = "cnf-2026:101";
		}
		for (const serving of attributedRecord.food.foodServings ?? []) {
			serving.source = "health-canada-cnf";
			serving.sourceReference = "cnf-2026:101";
		}

		expect(() =>
			mapApprovedCatalogRecordToBlendCalcAPIV1Product(
				attributedRecord,
				attributionCatalog(
					{
						"health-canada-cnf": sourceAttribution(
							"health-canada-cnf",
							"Health Canada Canadian Nutrient File",
							"Open Government Licence – Canada",
						),
					},
					{ "health-canada-cnf": {} },
				),
			),
		).toThrow("Required API dataset attribution is unavailable.");
	});

	it("uses provider attribution for direct records from a source that also publishes datasets", () => {
		const directProviderRecord = structuredClone(record);
		for (const fieldSource of Object.values(
			directProviderRecord.fieldProvenance,
		)) {
			fieldSource.source = "usda";
			fieldSource.sourceReference = "2032704";
		}
		for (const nutrient of directProviderRecord.food.foodNutrients) {
			nutrient.source = "usda";
			nutrient.sourceReference = "2032704";
		}
		for (const serving of directProviderRecord.food.foodServings ?? []) {
			serving.source = "usda";
			serving.sourceReference = "2032704";
		}
		const providerAttribution = sourceAttribution(
			"usda",
			"USDA FoodData Central",
			"CC0 1.0",
		);

		const product = mapApprovedCatalogRecordToBlendCalcAPIV1Product(
			directProviderRecord,
			attributionCatalog(
				{ usda: providerAttribution },
				{
					usda: {
						"usda-sr-legacy": sourceAttribution(
							"usda",
							"USDA FoodData Central SR Legacy",
							"CC0 1.0",
						),
					},
				},
			),
		);

		expect(product.sourceAttributions).toEqual([providerAttribution]);
	});
});
