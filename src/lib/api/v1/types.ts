import type { ApiV1ErrorCode } from "$lib/api/v1/errors";

export const BLENDCALC_API_V1 = "1.0" as const;

export type ApiV1Source = {
	source: string;
	reference: string | null;
	confidence: string | null;
};

export type ApiV1FieldSource = ApiV1Source & {
	observationId: string;
	observedAt: string;
	verificationMethod:
		| "exact-barcode"
		| "package-label"
		| "corroborated-sources"
		| "moderator-reviewed"
		| null;
	reviewState: "accepted" | "moderator-reviewed";
};

export type ApiV1SourceAttribution = {
	source: string;
	displayName: string;
	sourceUrl: string;
	licenseName: string;
	licenseUrl: string;
	attribution: string;
	redistributionPolicyReviewedAt: string;
	dataset: {
		key: string;
		name: string;
		version: string;
		importedAt: string;
	} | null;
};

export type ApiV1Category = {
	id: string;
	name: string;
	slug: string;
	updatedAt: string | null;
};

export type ApiV1Nutrient = {
	id: number;
	name: string;
	number: string | null;
	unit: string;
	amountPer100g: number | null;
	valueStatus: "reported" | "estimated" | "derived" | "missing" | "unknown";
	source: ApiV1Source | null;
	quality: {
		sourceValueStatus:
			| "reported"
			| "reported-zero"
			| "estimated"
			| "derived"
			| "trace"
			| "present-unquantified"
			| "missing"
			| "invalid"
			| "unknown";
		standardError: number | null;
		sourceNutrientKey: string | null;
		sourceNutrientCode: string | null;
		mappingStatus: "canonical" | "unmapped" | "excluded" | "unknown";
		mappingMethod: string | null;
		derivationMethod: string | null;
		valueQualifier: "source-estimate" | null;
	};
};

export type ApiV1Serving = {
	label: string;
	grams: number | null;
	quantity: number | null;
	unit: string | null;
	gramsPerUnit: number | null;
	isPrimary: boolean;
	measureType: string | null;
	isHouseholdMeasure: boolean;
	sourceMeasureKey: string | null;
	origin: string;
	gramWeightMethod: string;
	calculationBasis: string | null;
	source: ApiV1Source | null;
};

export type ApiV1ImagePlacement = {
	fitMode: string;
	x: number;
	y: number;
	zoom: number;
	rotationDegrees: number;
	version: number;
};

export type ApiV1Image = {
	role: string;
	url: string;
	thumbnailUrl: string | null;
	sourceName: string;
	sourceUrl: string;
	license: {
		name: string;
		url: string;
		attribution: string;
	};
	placement: ApiV1ImagePlacement;
	source: ApiV1Source;
	approvedAt: string | null;
	retrievedAt: string;
};

export type ApiV1Warning = {
	code: string;
	message: string;
	category: string;
	type: string;
	sourceType: string;
	confidence: string;
	sourceText: string | null;
};

export type ApiV1CompatibilityEvaluation = {
	version: 1;
	status: "conflict" | "checked" | "incomplete" | "not_checked";
	policyVersion: number | null;
	profileApplied: boolean;
	conflictCount: number;
	coverage: {
		basis:
			| "generic-taxonomy"
			| "packaged-label"
			| "private-entry"
			| "unknown-identity";
		identity: "available" | "missing" | "not_required";
		ingredients: "available" | "missing" | "not_required";
		allergens: "available" | "missing" | "not_required";
		traces: "available" | "missing" | "not_required";
		policy: "available" | "missing" | "not_required";
	};
};

export type ApiV1ProductRevision = {
	id: string | null;
	number: number | null;
	currentSince: string | null;
	currentSinceBasis: "manufacturer-effective" | "blendcalc-observed" | null;
	labelObservedAt: string | null;
	updatedAt: string;
	lastVerifiedAt: string | null;
};

export type ApiV1ProductRevisionValue =
	| string
	| number
	| null
	| { value: number; unit: string };

export type ApiV1ProductRevisionChange = {
	field: string;
	label: string;
	changeType: "added" | "removed" | "changed";
	previousValue: ApiV1ProductRevisionValue;
	newValue: ApiV1ProductRevisionValue;
	severity: "low" | "medium" | "high";
};

export type ApiV1ProductRevisionHistoryItem = {
	id: string;
	number: number;
	publishedAt: string;
	labelObservedAt: string;
	changes: ApiV1ProductRevisionChange[];
};

export type ApiV1StructuredIngredient = {
	id: string | null;
	text: string | null;
	percent: number | null;
	percentEstimate: number | null;
	percentMin: number | null;
	percentMax: number | null;
	vegan: string | null;
	vegetarian: string | null;
	ingredients: ApiV1StructuredIngredient[];
};

export type ApiV1PrecautionaryStatement = {
	type:
		| "may_contain"
		| "shared_equipment"
		| "shared_facility"
		| "other_precautionary";
	text: string;
	allergens: string[];
	languageCode: string | null;
	sourceField: string;
	sourceReference: string | null;
	observationId: string | null;
	revisionId: string | null;
	labelObservedAt: string | null;
};

export type ApiV1Product = {
	id: string;
	barcode: string;
	name: string;
	brand: string | null;
	category: ApiV1Category | null;
	ingredients: {
		text: string | null;
		items: string[];
		structured: ApiV1StructuredIngredient[];
		analysis: {
			ingredientTags: string[];
			analysisTags: string[];
			derivedTraceTags: string[];
			percentAnalysis: number | null;
			percentEstimate: number | null;
			percentKnown: number | null;
			percentUnknown: number | null;
		} | null;
		additives: string[];
		allergens: string[];
		traces: string[];
		precautionaryStatements: ApiV1PrecautionaryStatement[];
		dietaryTags: string[];
		labels: string[];
	};
	packageQuantity: {
		label: string | null;
		amount: number | null;
		unit: string | null;
	} | null;
	sourceRecord: {
		language: string | null;
		languages: string[];
		marketCountries: string[];
		revision: number | null;
		schemaVersion: number | null;
		createdAt: string | null;
		publishedAt: string | null;
		availableAt: string | null;
		modifiedAt: string | null;
		updatedAt: string | null;
		discontinuedAt: string | null;
		completeness: number | null;
		qualityTags: string[];
		qualityErrorTags: string[];
		qualityWarningTags: string[];
		obsolete: boolean | null;
		obsoleteSince: string | null;
		tagSources: Partial<Record<
			| "additives"
			| "allergens"
			| "categories"
			| "countries"
			| "ingredients"
			| "labels"
			| "languages"
			| "nutrients"
			| "packaging"
			| "traces",
			string[]
		>>;
	} | null;
	nutrients: ApiV1Nutrient[];
	servings: ApiV1Serving[];
	images: ApiV1Image[];
	warnings: ApiV1Warning[];
	compatibilityEvaluation: ApiV1CompatibilityEvaluation;
	sourceAttributions: ApiV1SourceAttribution[];
	catalog: {
		authority: "blendcalc-shared-catalog";
		status: "active";
		verification: string;
		redistributionPolicy: "approved";
		sourceCount: number;
	};
	fieldSources: {
		name: ApiV1FieldSource | null;
		brand: ApiV1FieldSource | null;
		category: ApiV1FieldSource | null;
		ingredients: ApiV1FieldSource | null;
		structuredIngredients: ApiV1FieldSource | null;
		ingredientAnalysis: ApiV1FieldSource | null;
		additives: ApiV1FieldSource | null;
		allergens: ApiV1FieldSource | null;
		traces: ApiV1FieldSource | null;
		precautionaryStatements: ApiV1FieldSource | null;
		dietaryTags: ApiV1FieldSource | null;
		labels: ApiV1FieldSource | null;
		package: ApiV1FieldSource | null;
		sourceMetadata: ApiV1FieldSource | null;
	};
	revision: ApiV1ProductRevision;
	links: {
		self: string;
	};
};

export type ApiV1Pagination = {
	limit: number;
	offset: number;
	total: number;
	hasMore: boolean;
	nextOffset: number | null;
};

export type ApiV1Success<Data> = {
	apiVersion: typeof BLENDCALC_API_V1;
	data: Data;
	meta?: {
		pagination: ApiV1Pagination;
	};
};

export type ApiV1Error = {
	apiVersion: typeof BLENDCALC_API_V1;
	error: {
		code: ApiV1ErrorCode;
		message: string;
	};
};
