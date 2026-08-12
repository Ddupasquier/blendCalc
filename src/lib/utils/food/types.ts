import type { FoodPreferenceWarning } from "$lib/utils/profile/foodPreferenceWarnings";
import type {
	FoodCompatibilityEvaluation,
	FoodCompatibilitySummary,
} from "$lib/utils/food/quality/compatibility";
import type {
	ImageFitMode,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type FoodNutrientValueStatus =
	| "reported"
	| "reported-zero"
	| "estimated"
	| "derived"
	| "trace"
	| "present-unquantified"
	| "missing"
	| "invalid"
	| "unknown";

export type FoodNutrientMappingStatus =
	"canonical" | "unmapped" | "excluded" | "unknown";

export type FoodNutrientValueQualifier = "source-estimate";

/** A single accepted numeric nutrient value from any supported food source. */
export interface FoodNutrient {
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string;
	unitName: string;
	value: number;
	valueOrigin?: "reported" | "estimated" | "derived";
	source?:
		| "usda"
		| "open-food-facts"
		| "health-canada-cnf"
		| "uk-cofid"
		| "fsanz-afcd"
		| "foodrepo"
		| "user-label"
		| "manufacturer"
		| "gs1"
		| "community-reviewed"
		| "unknown";
	sourceReference?: string;
	confidence?:
		| "source-verified"
		| "moderator-reviewed"
		| "corroborated"
		| "user-reported"
		| "imported"
		| "unknown";
	valueStatus?: FoodNutrientValueStatus;
	valueQualifier?: FoodNutrientValueQualifier;
	standardError?: number;
	sourceNutrientKey?: string;
	sourceNutrientCode?: string;
	mappingStatus?: FoodNutrientMappingStatus;
	mappingMethod?: string;
	mappingReviewReference?: string;
	derivationMethod?: string;
}

export type FoodNutrientSourceReview = {
	nutrientId?: number;
	nutrientName: string;
	unitName?: string;
	amountPer100g?: number;
	standardError?: number;
	sourceNutrientKey?: string;
	sourceNutrientCode?: string;
	valueStatus: FoodNutrientValueStatus;
	valueQualifier?: FoodNutrientValueQualifier;
	mappingStatus: FoodNutrientMappingStatus;
	mappingMethod?: string;
	mappingReviewReference?: string;
	derivationMethod?: string;
	source?: FoodNutrient["source"];
	sourceReference?: string;
};

export interface FoodImageAsset {
	source: "open-food-facts" | "wikimedia-commons" | "community-reviewed";
	sourceReference?: string;
	role: "front" | "nutrition" | "barcode" | "ingredient" | "generic";
	imageUrl: string;
	thumbnailUrl?: string;
	storagePath?: string;
	licenseName: string;
	licenseUrl?: string;
	attributionText?: string;
	confidence: "source-verified" | "moderator-reviewed" | "imported";
	cropX?: number;
	cropY?: number;
	cropZoom?: number;
	rotationDegrees?: ImagePlacementValue["rotationDegrees"];
	cropSource?: "auto" | "user" | "moderator";
	fitMode?: ImageFitMode;
	placementVersion?: number;
	placementMethod?: ImagePlacementValue["placementMethod"];
	suggestionVersion?: string;
	suggestionConfidence?: number;
	suggestionAcceptedAt?: string;
	approvedBy?: string;
	approvedAt?: string;
	fetchedAt?: string;
}

export type FoodServingOrigin =
	| "package-label"
	| "source-household-measure"
	| "source-weight"
	| "user-entered"
	| "calculated-conversion"
	| "unknown";

export type FoodServingGramWeightMethod =
	| "source-reported"
	| "exact-unit-conversion"
	| "user-reported"
	| "calculated-conversion"
	| "unknown";

export interface FoodServing {
	label: string;
	gramWeight: number;
	amount?: number;
	unitKey?: string;
	isPrimary: boolean;
	measureType?: string;
	isHouseholdMeasure?: boolean;
	sourceMeasureKey?: string;
	origin?: FoodServingOrigin;
	gramWeightMethod?: FoodServingGramWeightMethod;
	calculationBasis?: string;
	source?: FoodNutrient["source"];
	sourceReference?: string;
	confidence?: FoodNutrient["confidence"];
}

export type FoodIdentityType =
	| "generic"
	| "packaged"
	| "private-custom"
	| "unknown";

export type FoodStructuredIngredient = {
	id?: string;
	text?: string;
	percent?: number;
	percentEstimate?: number;
	percentMin?: number;
	percentMax?: number;
	vegan?: string;
	vegetarian?: string;
	ingredients?: FoodStructuredIngredient[];
};

export type FoodIngredientAnalysis = {
	ingredientTags: string[];
	analysisTags: string[];
	derivedTraceTags: string[];
	percentAnalysis?: number;
	percentEstimate?: number;
	percentKnown?: number;
	percentUnknown?: number;
};

export type FoodIngredientPresentationClassification = {
	label: "Vegan" | "Vegetarian";
	value: string;
};

export type FoodIngredientPresentationRow = {
	text: string;
	depth: number;
	path: string[];
	percentageLabel: string | null;
	classifications: FoodIngredientPresentationClassification[];
};

export type FoodIngredientPresentationMetric = {
	label: string;
	value: string;
};

export type FoodIngredientPresentationTagGroup = {
	label: string;
	values: string[];
};

export type FoodIngredientPresentation = {
	ingredientText: string | null;
	rows: FoodIngredientPresentationRow[];
	additives: string[];
	metrics: FoodIngredientPresentationMetric[];
	tagGroups: FoodIngredientPresentationTagGroup[];
	hasSourceAnalysis: boolean;
};

export type FoodPackageQuantity = {
	label?: string;
	amount?: number;
	unit?: string;
};

export type FoodSourceRecordMetadata = {
	language?: string;
	languages?: string[];
	marketCountries?: string[];
	revision?: number;
	schemaVersion?: number;
	createdAt?: string;
	publishedAt?: string;
	availableAt?: string;
	modifiedAt?: string;
	updatedAt?: string;
	discontinuedAt?: string;
	completeness?: number;
	qualityTags?: string[];
	qualityErrorTags?: string[];
	qualityWarningTags?: string[];
	obsolete?: boolean;
	obsoleteSince?: string;
	tagSources?: Record<string, string[]>;
};

export type FoodTrackedField =
	| "productName"
	| "brandOwner"
	| "nutrition"
	| "image"
	| "categories"
	| "serving"
	| "ingredients"
	| "allergens"
	| "traces"
	| "precautionaryStatements"
	| "dietaryTags"
	| "labels"
	| "structuredIngredients"
	| "ingredientAnalysis"
	| "additives"
	| "package"
	| "sourceMetadata";

export type FoodDescriptiveSourceField =
	| "scientificName"
	| "alternateDescription"
	| "preparation";

export type FoodProvenanceField =
	| FoodTrackedField
	| FoodDescriptiveSourceField;

export type FoodFieldSource = {
	source:
		| NonNullable<FoodNutrient["source"]>
		| FoodImageAsset["source"]
		| "shared-catalog";
	sourceReference?: string;
	confidence?: NonNullable<FoodNutrient["confidence"]>;
	observationId?: string;
	observedAt?: string;
	verificationMethod?:
		| "exact-barcode"
		| "exact-source-record"
		| "package-label"
		| "corroborated-sources"
		| "moderator-reviewed";
	reviewState?: "unreviewed" | "accepted" | "moderator-reviewed";
};

export type FoodFieldProvenance = Partial<
	Record<FoodProvenanceField, FoodFieldSource>
>;

export type FoodSourceEnrichmentReason =
	| "missing-current-value"
	| "stronger-review-state"
	| "stronger-confidence"
	| "more-complete-evidence"
	| "newer-observation";

export type FoodSourceEnrichmentDecision = {
	field: FoodProvenanceField;
	nutrientId?: number;
	reason: FoodSourceEnrichmentReason;
	selectedSource: FoodFieldSource;
	previousSource?: FoodFieldSource;
};

export type FoodTrustStatus =
	| "source-verified"
	| "imported"
	| "corroborated"
	| "moderator-reviewed"
	| "pending-review"
	| "unverified"
	| "user-private";

export type FoodBarcodeProvenance = {
	captureMethod: "manual-entry" | "linear-scan" | "gs1-digital-link";
	sourceReference?: string;
	format?: string;
};

export type FoodSourceAttribution = {
	datasetKey: string;
	datasetName: string;
	datasetVersion: string;
	sourceName: string;
	sourceUrl: string;
	licenseName: string;
	licenseUrl: string;
	attributionText: string;
};

export type FoodAllergenDisclosure = {
	contains: string[];
	mayContain: string[];
};

export type FoodPrecautionaryStatementType =
	| "may_contain"
	| "shared_equipment"
	| "shared_facility"
	| "other_precautionary";

export type FoodPrecautionaryStatement = {
	type: FoodPrecautionaryStatementType;
	text: string;
	allergens: string[];
	languageCode?: string;
	sourceField: string;
	sourceReference?: string;
	observationId?: string;
	revisionId?: string;
	labelObservedAt?: string;
};

/** A normalized food item assembled from catalog, provider, or user evidence. */
export interface FoodItem {
	fdcId: number;
	description: string;
	/** Source/catalog name retained when a user assigns a personal list name. */
	canonicalDescription?: string;
	sourceIdentifiers?: Record<string, string>;
	nameProvenance?: "source" | "barcode" | "user";
	brandOwner?: string;
	foodCategory?: string;
	brandedFoodCategory?: string;
	foodNutrients: FoodNutrient[];
	/** Source rows retained for uncertainty and mapping review, never for nutrition math. */
	nutrientSourceReview?: FoodNutrientSourceReview[];
	/** Nutrient IDs explicitly reported by the source. Missing IDs are unknown, not zero. */
	reportedNutrientIds?: number[];
	// Branded food fields (optional)
	dataType?: string;
	foodIdentityType?: FoodIdentityType;
	scientificName?: string;
	alternateDescription?: string;
	preparation?: string;
	publishedDate?: string;
	publicationDate?: string;
	modifiedDate?: string;
	availableDate?: string;
	discontinuedDate?: string;
	marketCountry?: string;
	packageWeight?: string;
	servingSize?: number;
	servingSizeUnit?: string;
	householdServingFullText?: string;
	hasSourceServing?: boolean;
	foodServings?: FoodServing[];
	gtinUpc?: string;
	ingredients?: string;
	ingredientList?: string[];
	structuredIngredients?: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	ingredientPresentation?: FoodIngredientPresentation;
	additives?: string[];
	allergens?: string[];
	traces?: string[];
	precautionaryStatements?: FoodPrecautionaryStatement[];
	dietaryTags?: string[];
	labels?: string[];
	packageQuantity?: FoodPackageQuantity;
	sourceMetadata?: FoodSourceRecordMetadata;
	categories?: string[];
	categoryOptionId?: string;
	symbolKey?: string;
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	/** Evidence decisions made while safely enriching a user-owned list snapshot. */
	sourceEnrichmentDecisions?: FoodSourceEnrichmentDecision[];
	customFood?: boolean;
	barcode?: string;
	barcodeSource?: "open-food-facts" | "usda" | "manual" | "community";
	barcodeProvenance?: FoodBarcodeProvenance;
	sourceKey?: string;
	sourceLabel?: string;
	sourceDataType?: string;
	sourcePublishedDate?: string;
	sourceModifiedDate?: string;
	sourceAttribution?: FoodSourceAttribution;
	sourceAttributions?: FoodSourceAttribution[];
	sharedProductId?: string;
	sharedProductSubmissionId?: string;
	trustStatus?: FoodTrustStatus;
	sharedProductConfidence?:
		"source-verified" | "moderator-reviewed" | "corroborated" | "imported";
	/** Timestamp for when this food was added to the current user list. */
	listAddedAt?: number;
	customServingLabel?: string;
	customServingWeightGrams?: number;
	customDensityGramsPerMilliliter?: number;
	customDensityLabel?: string;
	customDensityVariancePercent?: number;
	customDensityConfidence?: "known" | "estimated" | "rough";
	compatibilitySummary?: FoodCompatibilitySummary;
	compatibilityEvaluation?: FoodCompatibilityEvaluation;
	allergenDisclosure?: FoodAllergenDisclosure;
	preferenceWarnings?: FoodPreferenceWarning[];
}

/** The USDA FoodData Central foods/search response envelope. */
export interface FdcSearchResponse {
	foods: FoodItem[];
	totalHits: number;
	currentPage: number;
	totalPages: number;
}

/** Key nutrient IDs we care about in the UI */
export const NUTRIENT_IDS = {
	CALORIES: 1008,
	PROTEIN: 1003,
	CARBS: 1005,
	FAT: 1004,
	FIBER: 1079,
	SUGAR: 2000,
	VITAMIN_C: 1162,
	POTASSIUM: 1092,
	CALCIUM: 1087,
	IRON: 1089,
	SODIUM: 1093,
	VITAMIN_A_RAE: 1106,
	VITAMIN_D_IU: 1110,
	VITAMIN_K1: 1185,
	CHOLESTEROL: 1253,
} as const;
