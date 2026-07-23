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
	ingredients: string;
	ingredientList: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	categories: string[];
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
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
	ingredients: "",
	ingredientList: [],
	allergens: [],
	traces: [],
	dietaryTags: [],
	labels: [],
	categories: [],
	image: undefined,
	fieldProvenance: undefined,
});

export const getInitialSaveDestination = (): SmoothieListKey => MIX_STORAGE_KEYS.fridge;
