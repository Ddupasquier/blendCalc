import type { FoodPreferenceWarning } from "$lib/utils/profile/foodPreferenceWarnings";
import type { FoodCompatibilitySummary } from "$lib/utils/food/quality/compatibility";
import type {
	ImageFitMode,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

/** A single food nutrient returned by the FDC API */
export interface FdcNutrient {
    nutrientId: number;
    nutrientName: string;
    nutrientNumber: string;
    unitName: string;
    value: number;
    valueOrigin?: "reported" | "derived";
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
}

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

export interface FoodServing {
    label: string;
    gramWeight: number;
    amount?: number;
    unitKey?: string;
    isPrimary: boolean;
    source?: FdcNutrient["source"];
    sourceReference?: string;
    confidence?: FdcNutrient["confidence"];
}

export type FoodIdentityType = "generic" | "packaged" | "private-custom";

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

export type FoodPackageQuantity = {
	label?: string;
	amount?: number;
	unit?: string;
};

export type FoodSourceRecordMetadata = {
	language?: string;
	languages?: string[];
	revision?: number;
	schemaVersion?: number;
	createdAt?: string;
	modifiedAt?: string;
	updatedAt?: string;
	completeness?: number;
	qualityTags?: string[];
	qualityErrorTags?: string[];
	qualityWarningTags?: string[];
	obsolete?: boolean;
	obsoleteSince?: string;
	tagSources?: Record<string, string[]>;
};

export type FoodTrackedField =
    | "nutrition"
    | "image"
    | "categories"
    | "serving"
    | "ingredients"
    | "allergens"
    | "traces"
    | "dietaryTags"
    | "labels"
	| "structuredIngredients"
	| "ingredientAnalysis"
	| "additives"
	| "package"
	| "sourceMetadata";

export type FoodFieldSource = {
    source:
        | NonNullable<FdcNutrient["source"]>
        | FoodImageAsset["source"]
        | "shared-catalog";
    sourceReference?: string;
    confidence?: NonNullable<FdcNutrient["confidence"]>;
};

export type FoodFieldProvenance = Partial<
    Record<FoodTrackedField, FoodFieldSource>
>;

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

/** A food item returned from the FDC search endpoint */
export interface FdcFood {
    fdcId: number;
    description: string;
    sourceIdentifiers?: Record<string, string>;
    nameProvenance?: "source" | "barcode" | "user";
    brandOwner?: string;
    foodCategory?: string;
    brandedFoodCategory?: string;
    foodNutrients: FdcNutrient[];
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
	additives?: string[];
    allergens?: string[];
    traces?: string[];
    dietaryTags?: string[];
    labels?: string[];
	packageQuantity?: FoodPackageQuantity;
	sourceMetadata?: FoodSourceRecordMetadata;
    categories?: string[];
    categoryOptionId?: string;
	symbolKey?: string;
    image?: FoodImageAsset;
    fieldProvenance?: FoodFieldProvenance;
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
    sharedProductId?: string;
    sharedProductSubmissionId?: string;
    trustStatus?: FoodTrustStatus;
    sharedProductConfidence?:
        | "source-verified"
        | "moderator-reviewed"
        | "corroborated"
        | "imported";
    /** Timestamp for when this food was added to the current user list. */
    listAddedAt?: number;
    customServingLabel?: string;
    customServingWeightGrams?: number;
    customDensityGramsPerMilliliter?: number;
    customDensityLabel?: string;
    customDensityVariancePercent?: number;
    customDensityConfidence?: "known" | "estimated" | "rough";
	    compatibilitySummary?: FoodCompatibilitySummary;
	    allergenDisclosure?: FoodAllergenDisclosure;
	    preferenceWarnings?: FoodPreferenceWarning[];
}

/** The FDC foods/search response envelope */
export interface FdcSearchResponse {
    foods: FdcFood[];
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

/** A smoothie ingredient derived from an FDC food item */
export interface Ingredient {
    fdcId: number;
    name: string;
    category?: string;
    servingGrams: number; // grams to include in the smoothie
    nutrients: FdcNutrient[];
}

/** A saved smoothie recipe */
export interface Smoothie {
    id: string;
    name: string;
    ingredients: Ingredient[];
    createdAt: number;
}

/** Aggregated nutrition totals for a smoothie */
export interface NutritionTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
}
