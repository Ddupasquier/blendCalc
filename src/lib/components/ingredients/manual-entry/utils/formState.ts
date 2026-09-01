import {
	getDefaultServingMeasureUnit,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type {
	FoodItem,
	FoodNutrient,
	FoodNutrientQualitativeFact,
	FoodFieldProvenance,
	FoodImageAsset,
	FoodBarcodeProvenance,
	FoodIdentityType,
	FoodIngredientAnalysis,
	FoodPackageQuantity,
	FoodSourceRecordMetadata,
	FoodStructuredIngredient,
	FoodServing,
	FoodAlcoholByVolume,
	FoodRegulatoryDisclosure,
	FoodSafetyAlert,
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
import { getFoodNutrientAmountForServingConversion } from "$lib/utils/food/nutrients/foodNutrients";
import { convertFoodServingMultiplier } from "$lib/utils/serving/servingAmount";
import { resolveFoodIdentityType } from "$lib/utils/food/identity/foodIdentity";

export type ManualEntryFormResetState = {
	activeStep: ManualEntryStepId;
	name: string;
	nameProvenance: NonNullable<FoodItem["nameProvenance"]>;
	brandOwner: string;
	category: string;
	categoryOptionId: string;
	categorySymbolKey: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	usesInternal100GramBasis: boolean;
	serving?: FoodServing;
	servingMeasureQuantity: number | null;
	servingMeasureUnit: ServingMeasureUnit;
	useServingMeasure: boolean;
	manualNutrientValues: NutrientValueState;
	manualTouchedNutrientIds: Record<number, true>;
	validationAttemptedSteps: ValidationAttemptState;
	importedNutrients: FoodNutrient[];
	nutrientQualitativeFacts: FoodNutrientQualitativeFact[];
	barcode: string;
	barcodeSource: FoodItem["barcodeSource"];
	barcodeProvenance?: FoodBarcodeProvenance;
	barcodeMessage: string;
	barcodeSafetyAlerts: FoodSafetyAlert[];
	checkingBarcodeReference: boolean;
	checkedBarcodeReferenceKey: string;
	barcodeReferenceDraft: BarcodeProductDraft | null;
	barcodeReferenceSourceDraft: BarcodeProductDraft | null;
	barcodeReferenceAcceptedBarcode: string;
	barcodeShareValidation: BarcodeShareValidationResult | null;
	validatingBarcodeShare: boolean;
	shareWithCatalog: boolean;
	shareSelectionSource: "none" | "automatic" | "declined" | "user";
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
	alcoholByVolume?: FoodAlcoholByVolume;
	regulatoryDisclosure?: FoodRegulatoryDisclosure;
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
	usesInternal100GramBasis: false,
	serving: undefined,
	servingMeasureQuantity: null,
	servingMeasureUnit: getDefaultServingMeasureUnit("volume") ?? "",
	useServingMeasure: false,
	manualNutrientValues: {},
	manualTouchedNutrientIds: {},
	validationAttemptedSteps: {},
	importedNutrients: [],
	nutrientQualitativeFacts: [],
	barcode: "",
	barcodeSource: "manual",
	barcodeProvenance: undefined,
	barcodeMessage: "",
	barcodeSafetyAlerts: [],
	checkingBarcodeReference: false,
	checkedBarcodeReferenceKey: "",
	barcodeReferenceDraft: null,
	barcodeReferenceSourceDraft: null,
	barcodeReferenceAcceptedBarcode: "",
	barcodeShareValidation: null,
	validatingBarcodeShare: false,
	shareWithCatalog: false,
	shareSelectionSource: "none",
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
	alcoholByVolume: undefined,
	regulatoryDisclosure: undefined,
	sourceMetadata: undefined,
	categories: [],
	image: undefined,
	fieldProvenance: undefined,
	submissionIntent: "catalog_share",
});

export const getManualEntryFormStateFromFood = (
	food: FoodItem,
	intent: CatalogSubmissionIntent,
): ManualEntryFormResetState => {
	const state = getManualEntryFormResetState();
	const serving = getPrimaryFoodServing(food);
	const servingWeightGrams =
		serving?.gramWeight ??
		food.customServingWeightGrams ??
		(food.servingSizeUnit?.toLowerCase() === "g"
			? food.servingSize
			: undefined) ??
		null;
	const usesInternal100GramBasis = food.hasSourceServing === false;
	const servingConversion = serving
		? convertFoodServingMultiplier(serving, 1)
		: null;
	const nutrientsPerServing = food.foodNutrients.flatMap((nutrient) => {
		if (usesInternal100GramBasis) return [{ ...nutrient }];
		if (!servingConversion) return [];
		const value = getFoodNutrientAmountForServingConversion(
			food,
			nutrient.nutrientId,
			servingConversion,
		);
		return value === null ? [] : [{ ...nutrient, value }];
	});
	const servingMeasureQuantity =
		serving?.amount ?? serving?.milliliterVolume ?? null;
	const servingMeasureUnit =
		serving?.unitKey ??
		(serving?.milliliterVolume
			? getDefaultServingMeasureUnit("volume")
			: null) ??
		getDefaultServingMeasureUnit("volume") ??
		"";
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
		servingLabel: usesInternal100GramBasis
			? ""
			: (serving?.label ??
				food.customServingLabel ??
				food.householdServingFullText ??
				(servingWeightGrams ? `${servingWeightGrams}g` : "Serving")),
		servingWeightGrams,
		usesInternal100GramBasis,
		serving: usesInternal100GramBasis ? undefined : (serving ?? undefined),
		servingMeasureQuantity,
		servingMeasureUnit,
		useServingMeasure:
			Number.isFinite(servingMeasureQuantity) &&
			Number(servingMeasureQuantity) > 0 &&
			Boolean(servingMeasureUnit),
		importedNutrients: nutrientsPerServing,
		nutrientQualitativeFacts: [...(food.nutrientQualitativeFacts ?? [])],
		manualNutrientValues: Object.fromEntries(
			nutrientsPerServing.map((nutrient) => [
				nutrient.nutrientId,
				nutrient.value,
			]),
		),
		barcode: food.barcode ?? food.gtinUpc ?? "",
		barcodeSource: food.barcodeSource ?? "community",
		barcodeProvenance: food.barcodeProvenance,
		barcodeSafetyAlerts: [...(food.safetyAlerts ?? [])],
		shareWithCatalog: intent === "catalog_correction",
		shareSelectionSource: intent === "catalog_correction" ? "user" : "none",
		reportedNutrientIds: [
			...(food.reportedNutrientIds ??
				food.foodNutrients.map((nutrient) => nutrient.nutrientId)),
		],
		foodIdentityType: resolveFoodIdentityType(food),
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
		alcoholByVolume: food.alcoholByVolume,
		regulatoryDisclosure: food.regulatoryDisclosure,
		sourceMetadata: food.sourceMetadata,
		categories: [...(food.categories ?? [])],
		image: food.image,
		fieldProvenance: food.fieldProvenance,
		submissionIntent: intent,
	};
};

export const getInitialSaveDestination = (): IngredientListKey =>
	MIX_STORAGE_KEYS.fridge;
