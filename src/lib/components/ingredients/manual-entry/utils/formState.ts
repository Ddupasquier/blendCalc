import {
	getDefaultServingMeasureUnit,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import type {
	FdcFood,
	FdcNutrient,
	FoodFieldProvenance,
	FoodImageAsset,
	FoodBarcodeProvenance,
	FoodIdentityType,
	FoodIngredientAnalysis,
	FoodPackageQuantity,
	FoodSourceRecordMetadata,
	FoodStructuredIngredient,
} from "$lib/utils/food/types";
import type {
	ManualEntryStepId,
	NutrientValueState,
} from "$lib/components/ingredients/manual-entry/formTypes";
import type { ValidationAttemptState } from "$lib/components/ingredients/manual-entry/utils/validationItems";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { BarcodeShareValidationResult } from "$lib/utils/products/catalog";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import { getPrimaryFoodServing } from "$lib/utils/food/servings/foodServings";

export type ManualEntryFormResetState = {
	activeStep: ManualEntryStepId;
	name: string;
	nameProvenance: NonNullable<FdcFood["nameProvenance"]>;
	brandOwner: string;
	category: string;
	categoryOptionId: string;
	categorySymbolKey: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	useVolumeEquivalent: boolean;
	manualNutrientValues: NutrientValueState;
	manualTouchedNutrientIds: Record<number, true>;
	validationAttemptedSteps: ValidationAttemptState;
	importedNutrients: FdcNutrient[];
	barcode: string;
	barcodeSource: FdcFood["barcodeSource"];
	barcodeProvenance?: FoodBarcodeProvenance;
	barcodeMessage: string;
	checkingBarcodeReference: boolean;
	checkedBarcodeReferenceKey: string;
	barcodeReferenceDraft: BarcodeProductDraft | null;
	barcodeReferenceSourceDraft: BarcodeProductDraft | null;
	barcodeReferenceAcceptedBarcode: string;
	barcodeShareValidation: BarcodeShareValidationResult | null;
	validatingBarcodeShare: boolean;
	shareWithCatalog: boolean;
	keptUnmatchedPrivate: boolean;
	frontPhoto: File | null;
	imagePlacement: ImagePlacementValue;
	nutritionPhoto: File | null;
	barcodePhoto: File | null;
	reportedNutrientIds: number[];
	foodIdentityType: FoodIdentityType;
	ingredients: string;
	ingredientList: string[];
	structuredIngredients: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	additives: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	packageQuantity?: FoodPackageQuantity;
	sourceMetadata?: FoodSourceRecordMetadata;
	categories: string[];
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	submissionIntent: CatalogSubmissionIntent;
};

export const getManualEntryFormResetState = (): ManualEntryFormResetState => ({
	activeStep: "identity",
	name: "",
	nameProvenance: "user",
	brandOwner: "",
	category: "",
	categoryOptionId: "",
	categorySymbolKey: "generic",
	servingLabel: "",
	servingWeightGrams: null,
	volumeQuantity: null,
	volumeUnit: getDefaultServingMeasureUnit("volume") ?? "",
	useVolumeEquivalent: false,
	manualNutrientValues: {},
	manualTouchedNutrientIds: {},
	validationAttemptedSteps: {},
	importedNutrients: [],
	barcode: "",
	barcodeSource: "manual",
	barcodeProvenance: undefined,
	barcodeMessage: "",
	checkingBarcodeReference: false,
	checkedBarcodeReferenceKey: "",
	barcodeReferenceDraft: null,
	barcodeReferenceSourceDraft: null,
	barcodeReferenceAcceptedBarcode: "",
	barcodeShareValidation: null,
	validatingBarcodeShare: false,
	shareWithCatalog: false,
	keptUnmatchedPrivate: false,
	frontPhoto: null,
	imagePlacement: createFullImagePlacement(),
	nutritionPhoto: null,
	barcodePhoto: null,
	reportedNutrientIds: [],
	foodIdentityType: "private-custom",
	ingredients: "",
	ingredientList: [],
	structuredIngredients: [],
	ingredientAnalysis: undefined,
	additives: [],
	allergens: [],
	traces: [],
	dietaryTags: [],
	labels: [],
	packageQuantity: undefined,
	sourceMetadata: undefined,
	categories: [],
	image: undefined,
	fieldProvenance: undefined,
	submissionIntent: "catalog_share",
});

export const getManualEntryFormStateFromFood = (
	food: FdcFood,
	intent: CatalogSubmissionIntent,
): ManualEntryFormResetState => {
	const state = getManualEntryFormResetState();
	const serving = getPrimaryFoodServing(food);
	const servingWeightGrams =
		serving?.gramWeight ??
		food.customServingWeightGrams ??
		food.servingSize ??
		100;
	const nutrientsPerServing = food.foodNutrients.map((nutrient) => ({
		...nutrient,
		value: (nutrient.value * servingWeightGrams) / 100,
	}));
	const primaryCategory =
		food.foodCategory ??
		food.categories?.find((category) => category.trim()) ??
		"";

	return {
		...state,
		name: food.canonicalDescription ?? food.description,
		nameProvenance: food.nameProvenance ?? "barcode",
		brandOwner: food.brandOwner ?? "",
		category: primaryCategory,
		categoryOptionId: food.categoryOptionId ?? "",
		categorySymbolKey: food.symbolKey ?? "generic",
		servingLabel:
			serving?.label ??
			food.customServingLabel ??
			food.householdServingFullText ??
			`${servingWeightGrams}g`,
		servingWeightGrams,
		importedNutrients: nutrientsPerServing,
		manualNutrientValues: Object.fromEntries(
			nutrientsPerServing.map((nutrient) => [
				nutrient.nutrientId,
				nutrient.value,
			]),
		),
		barcode: food.barcode ?? food.gtinUpc ?? "",
		barcodeSource: food.barcodeSource ?? "community",
		barcodeProvenance: food.barcodeProvenance,
		shareWithCatalog: intent === "catalog_correction",
		reportedNutrientIds: [
			...(food.reportedNutrientIds ??
				food.foodNutrients.map((nutrient) => nutrient.nutrientId)),
		],
		foodIdentityType: food.foodIdentityType ?? "packaged",
		ingredients: food.ingredients ?? "",
		ingredientList: [...(food.ingredientList ?? [])],
		structuredIngredients: [...(food.structuredIngredients ?? [])],
		ingredientAnalysis: food.ingredientAnalysis,
		additives: [...(food.additives ?? [])],
		allergens: [...(food.allergens ?? [])],
		traces: [...(food.traces ?? [])],
		dietaryTags: [...(food.dietaryTags ?? [])],
		labels: [...(food.labels ?? [])],
		packageQuantity: food.packageQuantity,
		sourceMetadata: food.sourceMetadata,
		categories: [...(food.categories ?? [])],
		image: food.image,
		fieldProvenance: food.fieldProvenance,
		submissionIntent: intent,
	};
};

export const getInitialSaveDestination = (): SmoothieListKey => MIX_STORAGE_KEYS.fridge;
