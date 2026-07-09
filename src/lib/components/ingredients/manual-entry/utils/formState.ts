import type { ServingMeasureUnit } from "../../../../../defaults/servingMeasureDefaults";
import { MIX_STORAGE_KEYS } from "../../../../../defaults/mixDefaults";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import type { FdcFood, FdcNutrient, FoodImageAsset } from "$lib/utils/food/types";
import type {
	ManualEntryStepId,
	NutrientValueState,
} from "$lib/components/ingredients/manual-entry/formTypes";
import type { ValidationAttemptState } from "$lib/components/ingredients/manual-entry/utils/validationItems";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

export type ManualEntryFormResetState = {
	activeStep: ManualEntryStepId;
	name: string;
	brandOwner: string;
	category: string;
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
	barcodeMessage: string;
	checkingBarcodeReference: boolean;
	checkedBarcodeReferenceKey: string;
	barcodeReferenceDraft: BarcodeProductDraft | null;
	barcodeReferenceSourceDraft: BarcodeProductDraft | null;
	barcodeReferenceAcceptedBarcode: string;
	shareWithCatalog: boolean;
	frontPhoto: File | null;
	imageCropX: number;
	imageCropY: number;
	imageCropZoom: number;
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
};

export const getManualEntryFormResetState = (): ManualEntryFormResetState => ({
	activeStep: "identity",
	name: "",
	brandOwner: "",
	category: "",
	servingLabel: "",
	servingWeightGrams: null,
	volumeQuantity: null,
	volumeUnit: "tbsp",
	useVolumeEquivalent: false,
	manualNutrientValues: {},
	manualTouchedNutrientIds: {},
	validationAttemptedSteps: {},
	importedNutrients: [],
	barcode: "",
	barcodeSource: "manual",
	barcodeMessage: "",
	checkingBarcodeReference: false,
	checkedBarcodeReferenceKey: "",
	barcodeReferenceDraft: null,
	barcodeReferenceSourceDraft: null,
	barcodeReferenceAcceptedBarcode: "",
	shareWithCatalog: false,
	frontPhoto: null,
	imageCropX: 50,
	imageCropY: 50,
	imageCropZoom: 1,
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
});

export const getInitialSaveDestination = (): SmoothieListKey | "custom-only" =>
	MIX_STORAGE_KEYS.fridge;
