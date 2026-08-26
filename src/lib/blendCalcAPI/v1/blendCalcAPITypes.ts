import type { BlendCalcAPIV1ErrorCode } from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";

export const BLENDCALC_API_V1 = "1.0" as const;

export type BlendCalcAPIV1Source = {
	source: string;
	reference: string | null;
	confidence: string | null;
};

export type BlendCalcAPIV1FieldSource = BlendCalcAPIV1Source & {
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

export type BlendCalcAPIV1SourceAttribution = {
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

export type BlendCalcAPIV1Category = {
	id: string;
	name: string;
	slug: string;
	updatedAt: string | null;
};

export type BlendCalcAPIV1Nutrient = {
	id: number;
	name: string;
	number: string | null;
	unit: string;
	amountPer100g: number | null;
	valueStatus: "reported" | "estimated" | "derived" | "missing" | "unknown";
	source: BlendCalcAPIV1Source | null;
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

export type BlendCalcAPIV1Serving = {
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
	source: BlendCalcAPIV1Source | null;
};

export type BlendCalcAPIV1ImagePlacement = {
	fitMode: string;
	x: number;
	y: number;
	zoom: number;
	rotationDegrees: number;
	version: number;
};

export type BlendCalcAPIV1Image = {
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
	placement: BlendCalcAPIV1ImagePlacement;
	source: BlendCalcAPIV1Source;
	approvedAt: string | null;
	retrievedAt: string;
};

export type BlendCalcAPIV1Warning = {
	code: string;
	message: string;
	category: string;
	type: string;
	sourceType: string;
	confidence: string;
	sourceText: string | null;
};

export type BlendCalcAPIV1CompatibilityEvaluation = {
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

export type BlendCalcAPIV1ProductRevision = {
	id: string | null;
	number: number | null;
	currentSince: string | null;
	currentSinceBasis: "manufacturer-effective" | "blendcalc-observed" | null;
	labelObservedAt: string | null;
	updatedAt: string;
	lastVerifiedAt: string | null;
};

export type BlendCalcAPIV1ProductRevisionValue =
	string | number | null | { value: number; unit: string };

export type BlendCalcAPIV1ProductRevisionChange = {
	field: string;
	label: string;
	changeType: "added" | "removed" | "changed";
	previousValue: BlendCalcAPIV1ProductRevisionValue;
	newValue: BlendCalcAPIV1ProductRevisionValue;
	severity: "low" | "medium" | "high";
};

export type BlendCalcAPIV1ProductRevisionHistoryItem = {
	id: string;
	number: number;
	publishedAt: string;
	labelObservedAt: string;
	changes: BlendCalcAPIV1ProductRevisionChange[];
};

export type BlendCalcAPIV1StructuredIngredient = {
	id: string | null;
	text: string | null;
	percent: number | null;
	percentEstimate: number | null;
	percentMin: number | null;
	percentMax: number | null;
	vegan: string | null;
	vegetarian: string | null;
	ingredients: BlendCalcAPIV1StructuredIngredient[];
};

export type BlendCalcAPIV1PrecautionaryStatement = {
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

export type BlendCalcAPIV1SafetyAlert = {
	id: string;
	type: "recall" | "public_health_alert";
	classification: string | null;
	status: string;
	productDescription: string;
	reason: string | null;
	recallingOrganization: string | null;
	packageDescription: string | null;
	codeInformation: string | null;
	requiresPackageCheck: boolean;
	reportDate: string | null;
	recallInitiatedAt: string | null;
	source: {
		key: string;
		name: string;
		url: string;
		attribution: string;
	};
};

export type BlendCalcAPIV1Product = {
	id: string;
	barcode: string;
	name: string;
	brand: string | null;
	category: BlendCalcAPIV1Category | null;
	ingredients: {
		text: string | null;
		items: string[];
		structured: BlendCalcAPIV1StructuredIngredient[];
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
		precautionaryStatements: BlendCalcAPIV1PrecautionaryStatement[];
		dietaryTags: string[];
		labels: string[];
	};
	packageQuantity: {
		label: string | null;
		amount: number | null;
		unit: string | null;
	} | null;
	alcoholByVolume: {
		percent: number;
		valueStatus: "reported" | "reported-zero";
		basis: "volume-percent";
		sourceUnit: string;
	} | null;
	regulatoryDisclosure: {
		profileKey: string;
		evidenceStatus: "source-reported" | "user-reported" | "moderator-reviewed";
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
		tagSources: Partial<
			Record<
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
			>
		>;
	} | null;
	nutrients: BlendCalcAPIV1Nutrient[];
	servings: BlendCalcAPIV1Serving[];
	images: BlendCalcAPIV1Image[];
	safetyAlerts: BlendCalcAPIV1SafetyAlert[];
	warnings: BlendCalcAPIV1Warning[];
	compatibilityEvaluation: BlendCalcAPIV1CompatibilityEvaluation;
	sourceAttributions: BlendCalcAPIV1SourceAttribution[];
	catalog: {
		authority: "blendcalc-shared-catalog";
		status: "active";
		verification: string;
		redistributionPolicy: "approved";
		sourceCount: number;
	};
	fieldSources: {
		name: BlendCalcAPIV1FieldSource | null;
		brand: BlendCalcAPIV1FieldSource | null;
		category: BlendCalcAPIV1FieldSource | null;
		ingredients: BlendCalcAPIV1FieldSource | null;
		structuredIngredients: BlendCalcAPIV1FieldSource | null;
		ingredientAnalysis: BlendCalcAPIV1FieldSource | null;
		additives: BlendCalcAPIV1FieldSource | null;
		allergens: BlendCalcAPIV1FieldSource | null;
		traces: BlendCalcAPIV1FieldSource | null;
		precautionaryStatements: BlendCalcAPIV1FieldSource | null;
		dietaryTags: BlendCalcAPIV1FieldSource | null;
		labels: BlendCalcAPIV1FieldSource | null;
		package: BlendCalcAPIV1FieldSource | null;
		alcoholByVolume: BlendCalcAPIV1FieldSource | null;
		regulatoryDisclosure: BlendCalcAPIV1FieldSource | null;
		sourceMetadata: BlendCalcAPIV1FieldSource | null;
	};
	revision: BlendCalcAPIV1ProductRevision;
	links: {
		self: string;
	};
};

export type BlendCalcAPIV1Pagination = {
	limit: number;
	offset: number;
	total: number;
	hasMore: boolean;
	nextOffset: number | null;
};

export type BlendCalcAPIV1Success<Data> = {
	apiVersion: typeof BLENDCALC_API_V1;
	data: Data;
	meta?: {
		pagination: BlendCalcAPIV1Pagination;
	};
};

export type BlendCalcAPIV1Error = {
	apiVersion: typeof BLENDCALC_API_V1;
	error: {
		code: BlendCalcAPIV1ErrorCode;
		message: string;
	};
};
