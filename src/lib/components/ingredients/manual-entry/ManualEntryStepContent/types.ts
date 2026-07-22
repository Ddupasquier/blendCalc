import type { FoodCategoryPickerOption } from "$lib/utils/food/categories/categoryPicker";
import type {
	ManualEntryNutrientDefinition,
	ManualEntryNutrientGroupsByStep,
} from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type {
	FoodCategoryPickerStatus,
	ManualEntryBarcodeSuggestion,
	ManualEntryStepId,
	ManualEntryVolumeOption,
	NutritionLabelOcrApplyPayload,
	StepValidationItem,
} from "../formTypes";
import type { ShareStepProps } from "../steps/ShareStep/types";

export type ManualEntryStepContentProps = Omit<
	ShareStepProps,
	"validationItems"
> & {
	activeStep: ManualEntryStepId;
	name: string;
	brandOwner: string;
	category: string;
	categoryOptionId: string;
	barcode: string;
	categoryWarningMessage: string;
	categorySourceValues: string[];
	barcodeValidationMessage: string;
	checkingBarcodeReference: boolean;
	barcodeSuggestion: ManualEntryBarcodeSuggestion;
	servingLabel: string;
	resolvedServingLabel: string;
	servingWeightGrams: number | null;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	volumeOptions: ManualEntryVolumeOption[];
	manualEntryNutrientGroups: ManualEntryNutrientGroupsByStep;
	loadingManualEntryNutrients: boolean;
	manualEntryNutrientError: string;
	nutritionLabelOcrMappings: NutritionLabelOcrMapping[];
	nutritionLabelOcrMappingError: string;
	nutritionPhoto: File | null;
	hideMacroUnavailableStatus: boolean;
	customIngredientValidationItems: StepValidationItem[];
	getAttemptedValidationItems: (
		items: StepValidationItem[],
	) => StepValidationItem[];
	getManualNutrientValue: (
		field: ManualEntryNutrientDefinition,
	) => number | null;
	onValueChange: (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => void;
	onApplyNutritionLabelOcr: (payload: NutritionLabelOcrApplyPayload) => void;
	isRequired: (field: ManualEntryNutrientDefinition) => boolean;
	onNameChange: (value: string) => void;
	onBrandChange: (value: string) => void;
	onCategoryChange: (option: FoodCategoryPickerOption) => void;
	onCategoryStatusChange: (status: FoodCategoryPickerStatus) => void;
	onBarcodeChange: (value: string) => void;
	onBarcodeBlur: () => void | Promise<void>;
	onApplyBarcodeSuggestion: () => void | Promise<void>;
	onKeepManualBarcodeEntry: () => void;
	onNameInput: (element: HTMLInputElement | null) => void;
	onServingLabelChange: (value: string) => void;
	onServingWeightChange: (value: number | null) => void;
	onUseVolumeChange: (value: boolean) => void;
	onVolumeQuantityChange: (value: number | null) => void;
	onVolumeUnitChange: (value: ServingMeasureUnit) => void;
	onNext: () => void | Promise<void>;
};
