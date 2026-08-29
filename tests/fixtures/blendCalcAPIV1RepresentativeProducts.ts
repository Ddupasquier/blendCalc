import type {
	BlendCalcAPIV1FieldSource,
	BlendCalcAPIV1Product,
	BlendCalcAPIV1SourceAttribution,
} from "$lib/blendCalcAPI/v1/blendCalcAPITypes";
import { blendCalcAPIV1ProductFixture } from "./blendCalcAPIV1Catalog";

const FIXTURE_DATE = "2026-08-11T12:00:00.000Z";

const createProductFixture = ({
	barcode,
	id,
	name,
}: {
	barcode: string;
	id: string;
	name: string;
}): BlendCalcAPIV1Product => {
	const product = structuredClone(blendCalcAPIV1ProductFixture);
	product.id = id;
	product.barcode = barcode;
	product.name = name;
	product.links.self = `/api/v1/products/${barcode}`;
	return product;
};

const createFieldSource = (
	source: string,
	reference: string,
): BlendCalcAPIV1FieldSource => ({
	source,
	reference,
	confidence: "source-verified",
	observationId: "4a51038c-d1ac-4c16-a8b1-f64694af6501",
	observedAt: FIXTURE_DATE,
	verificationMethod: "exact-barcode",
	reviewState: "accepted",
});

const openFoodFactsAttribution: BlendCalcAPIV1SourceAttribution = {
	source: "open-food-facts",
	displayName: "Open Food Facts",
	sourceUrl: "https://world.openfoodfacts.org",
	licenseName: "ODbL-1.0",
	licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
	attribution: "Open Food Facts contributors",
	redistributionPolicyReviewedAt: FIXTURE_DATE,
	dataset: null,
};

export const blendCalcAPIV1GenericFoodFixture = createProductFixture({
	id: "f70645e6-f82b-478b-a36d-58c67a364f6a",
	barcode: "90000000000003",
	name: "Spinach, Raw",
});
blendCalcAPIV1GenericFoodFixture.brand = null;
blendCalcAPIV1GenericFoodFixture.category = {
	id: "vegetables",
	name: "Vegetables",
	slug: "vegetables",
	updatedAt: FIXTURE_DATE,
};
blendCalcAPIV1GenericFoodFixture.ingredients = {
	text: null,
	items: [],
	structured: [],
	analysis: null,
	additives: [],
	allergens: [],
	traces: [],
	precautionaryStatements: [],
	dietaryTags: ["vegan", "vegetarian"],
	labels: [],
};
blendCalcAPIV1GenericFoodFixture.compatibilityEvaluation = {
	version: 1,
	status: "checked",
	policyVersion: 3,
	profileApplied: true,
	conflictCount: 0,
	coverage: {
		basis: "generic-taxonomy",
		identity: "available",
		ingredients: "not_required",
		allergens: "not_required",
		traces: "not_required",
		policy: "available",
	},
};

export const blendCalcAPIV1CompletePackagedProductFixture =
	createProductFixture({
		id: "973ead4e-02d5-410f-8794-8943384dbaf2",
		barcode: "90000000000010",
		name: "Complete Package Label Fixture",
	});
blendCalcAPIV1CompletePackagedProductFixture.ingredients = {
	text: "Tomatoes, milk, salt",
	items: ["Tomatoes", "Milk", "Salt"],
	structured: [
		{
			id: "en:tomato",
			text: "Tomatoes",
			percent: 80,
			percentEstimate: 80,
			percentMin: null,
			percentMax: null,
			vegan: "yes",
			vegetarian: "yes",
			ingredients: [],
		},
	],
	analysis: {
		ingredientTags: ["en:tomato", "en:milk", "en:salt"],
		analysisTags: ["en:contains-milk"],
		derivedTraceTags: [],
		percentAnalysis: 100,
		percentEstimate: 100,
		percentKnown: 80,
		percentUnknown: 20,
	},
	additives: [],
	allergens: ["Milk"],
	traces: [],
	precautionaryStatements: [],
	dietaryTags: ["vegetarian"],
	labels: ["Gluten-free"],
};
blendCalcAPIV1CompletePackagedProductFixture.packageQuantity = {
	label: "24 oz",
	amount: 24,
	unit: "oz",
};
blendCalcAPIV1CompletePackagedProductFixture.nutrients = [
	{
		id: 1008,
		name: "Energy",
		number: "208",
		unit: "KCAL",
		amountPer100g: 60,
		valueStatus: "reported",
		source: {
			source: "usda",
			reference: "fixture-usda-1008",
			confidence: "source-verified",
		},
		quality: {
			sourceValueStatus: "reported",
			standardError: null,
			sourceNutrientKey: "1008",
			sourceNutrientCode: "208",
			mappingStatus: "canonical",
			mappingMethod: "exact-source-key",
			derivationMethod: null,
			valueQualifier: null,
		},
	},
];
blendCalcAPIV1CompletePackagedProductFixture.servings = [
	{
		label: "1/2 cup",
		grams: 125,
		quantity: 0.5,
		unit: "cup",
		gramsPerUnit: 250,
		isPrimary: true,
		measureType: "Package serving",
		isHouseholdMeasure: true,
		sourceMeasureKey: "serving-size",
		origin: "package-label",
		gramWeightMethod: "source-reported",
		calculationBasis: "Package reports 1/2 cup as 125g",
		source: {
			source: "usda",
			reference: "fixture-usda-serving",
			confidence: "source-verified",
		},
	},
];
blendCalcAPIV1CompletePackagedProductFixture.fieldSources.ingredients =
	createFieldSource("usda", "fixture-usda-ingredients");
blendCalcAPIV1CompletePackagedProductFixture.fieldSources.allergens =
	createFieldSource("usda", "fixture-usda-allergens");
blendCalcAPIV1CompletePackagedProductFixture.compatibilityEvaluation = {
	version: 1,
	status: "checked",
	policyVersion: 3,
	profileApplied: true,
	conflictCount: 0,
	coverage: {
		basis: "packaged-label",
		identity: "available",
		ingredients: "available",
		allergens: "available",
		traces: "available",
		policy: "available",
	},
};

export const blendCalcAPIV1ServingFixture = createProductFixture({
	id: "897d9e1a-92ec-4b01-9f2b-1ae830d2ee68",
	barcode: "90000000000027",
	name: "Exact Serving Fixture",
});
blendCalcAPIV1ServingFixture.servings = structuredClone(
	blendCalcAPIV1CompletePackagedProductFixture.servings,
);

export const blendCalcAPIV1AllergenFixture = createProductFixture({
	id: "292774e2-6daa-4abc-b53a-e8059c65d14d",
	barcode: "90000000000034",
	name: "Allergen Evidence Fixture",
});
blendCalcAPIV1AllergenFixture.ingredients = {
	...structuredClone(blendCalcAPIV1ProductFixture.ingredients),
	text: "Wheat flour, milk",
	items: ["Wheat flour", "Milk"],
	allergens: ["Milk", "Wheat"],
	traces: ["Soy"],
	precautionaryStatements: [
		{
			type: "may_contain",
			text: "May contain soy",
			allergens: ["Soy"],
			languageCode: "en",
			sourceField: "traces",
			sourceReference: "fixture-label-allergens",
			observationId: "d7647c85-bac7-4e74-8d83-33f931a7858a",
			revisionId: "a89fc15f-ffcd-4d03-92e9-2b511bb300ca",
			labelObservedAt: FIXTURE_DATE,
		},
	],
};
blendCalcAPIV1AllergenFixture.warnings = [
	{
		code: "allergen-milk",
		message: "Milk appears in the ingredient list.",
		category: "allergen",
		type: "contains",
		sourceType: "ingredient-list",
		confidence: "source-verified",
		sourceText: "milk",
	},
];
blendCalcAPIV1AllergenFixture.compatibilityEvaluation = {
	version: 1,
	status: "conflict",
	policyVersion: 3,
	profileApplied: true,
	conflictCount: 1,
	coverage: {
		basis: "packaged-label",
		identity: "available",
		ingredients: "available",
		allergens: "available",
		traces: "available",
		policy: "available",
	},
};

export const blendCalcAPIV1ImageFixture = createProductFixture({
	id: "7687a199-a707-485d-afc7-f409176106a6",
	barcode: "90000000000041",
	name: "Licensed Image Fixture",
});
blendCalcAPIV1ImageFixture.sourceAttributions = [
	...blendCalcAPIV1ImageFixture.sourceAttributions,
	openFoodFactsAttribution,
];
blendCalcAPIV1ImageFixture.images = [
	{
		role: "front",
		url: "https://images.example/fixture-front.jpg",
		thumbnailUrl: "https://images.example/fixture-front-small.jpg",
		sourceName: "Open Food Facts",
		sourceUrl: "https://world.openfoodfacts.org",
		license: {
			name: "CC BY-SA 3.0",
			url: "https://creativecommons.org/licenses/by-sa/3.0/",
			attribution: "Open Food Facts contributors",
		},
		placement: {
			fitMode: "custom",
			x: 45,
			y: 50,
			zoom: 1.25,
			rotationDegrees: 0,
			version: 2,
		},
		source: {
			source: "open-food-facts",
			reference: "fixture-image-reference",
			confidence: "source-verified",
		},
		approvedAt: FIXTURE_DATE,
		retrievedAt: FIXTURE_DATE,
	},
];

export const blendCalcAPIV1RepresentativePublishedProductFixtures = [
	{
		caseName: "generic food",
		product: blendCalcAPIV1GenericFoodFixture,
	},
	{
		caseName: "complete packaged product",
		product: blendCalcAPIV1CompletePackagedProductFixture,
	},
	{
		caseName: "exact serving evidence",
		product: blendCalcAPIV1ServingFixture,
	},
	{
		caseName: "allergen evidence",
		product: blendCalcAPIV1AllergenFixture,
	},
	{
		caseName: "licensed image",
		product: blendCalcAPIV1ImageFixture,
	},
] satisfies Array<{ caseName: string; product: BlendCalcAPIV1Product }>;

export const blendCalcAPIV1PartialPackagedProductFixture = {
	caseName: "partial packaged product",
	barcode: blendCalcAPIV1ProductFixture.barcode,
	candidate: blendCalcAPIV1ProductFixture,
	blockingReasons: [
		"missing_normalized_nutrients",
		"missing_evidence_backed_primary_serving",
	],
	expectedPublicResult: "product_not_found",
} as const;

export const blendCalcAPIV1SourceConflictFixture = {
	caseName: "unresolved source conflict",
	barcode: "90000000000058",
	field: "servingWeightGrams",
	conflictingSources: ["usda", "open-food-facts"],
	blockingReason: "unresolved_material_conflict",
	expectedPublicResult: "product_not_found",
} as const;
