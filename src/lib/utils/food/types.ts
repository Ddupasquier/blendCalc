/** A single food nutrient returned by the FDC API */
export interface FdcNutrient {
    nutrientId: number;
    nutrientName: string;
    nutrientNumber: string;
    unitName: string;
    value: number;
}

/** A food item returned from the FDC search endpoint */
export interface FdcFood {
    fdcId: number;
    description: string;
    brandOwner?: string;
    foodCategory?: string;
    foodNutrients: FdcNutrient[];
    // Branded food fields (optional)
    dataType?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    householdServingFullText?: string;
    gtinUpc?: string;
    customFood?: boolean;
    barcode?: string;
    barcodeSource?: "open-food-facts" | "usda" | "manual" | "community";
    sharedProductId?: string;
    sharedProductConfidence?: "source-verified" | "moderator-reviewed";
    customServingLabel?: string;
    customServingWeightGrams?: number;
    customDensityGramsPerMilliliter?: number;
    customDensityLabel?: string;
    customDensityVariancePercent?: number;
    customDensityConfidence?: "known" | "estimated" | "rough";
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
