import type { Snippet } from "svelte";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";
import type {
	ManualEntryNutrientDefinition,
	ManualEntryNutrientGroup,
	ManualEntryNutrientGroupsByStep,
} from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodCategoryPickerOption } from "$lib/utils/food/categories/categoryPicker";
import type {
	NutritionLabelOcrCandidate,
	NutritionLabelOcrMapping,
	NutritionLabelOcrProgress,
	NutritionLabelOcrRecognition,
	NutritionLabelServingCandidate,
} from "$lib/utils/food/ocr/nutritionLabelOcr";

export type ManualEntryStepId =
	| "identity"
	| "servings"
	| "macros"
	| "extended"
	| "share";

export type NutrientValueState = Record<number, number>;

export type ManualEntryValidationItem = {
	message: string;
	tone: "error" | "warning";
};

export type StepValidationItem = ManualEntryValidationItem & {
	step: ManualEntryStepId;
	showImmediately?: boolean;
};

export type ManualEntrySummaryItem = {
	label: string;
	value: number;
	unitName: string;
};

export type ManualEntryBarcodeSuggestion = {
	name: string;
	brandOwner: string;
	sourceLabel: string;
} | null;

export type FoodCategoryPickerStatus = {
	error: string;
	hasOptions: boolean;
	loading: boolean;
};

export type FoodCategoryPickerProps = {
	selectedId: string;
	selectedLabel: string;
	productName: string;
	sourceCategories: string[];
	warningMessage?: string;
	onChange: (option: FoodCategoryPickerOption) => void;
	onStatusChange?: (status: FoodCategoryPickerStatus) => void;
};

export type ManualEntryFormShellProps = {
	inline?: boolean;
	activeStep: ManualEntryStepId;
	steps: ManualEntryStep[];
	saving?: boolean;
	lookingUpBarcode?: boolean;
	stepWarningMessage?: string;
	stepWarningStep?: ManualEntryStepId | null;
	children: Snippet;
	onSelectStep: (step: ManualEntryStepId) => void;
	onDetailsElement?: (element: HTMLDetailsElement | null) => void;
	onBodyElement?: (element: HTMLFieldSetElement | null) => void;
};

export type ManualEntryLauncherProps = {
	onSelect: () => void;
};

export type ManualEntryScanOptionProps = {
	scanning?: boolean;
	disabled?: boolean;
	onScan: () => void;
};

export type ManualEntryToggleProps = {
	title?: string;
	description?: string;
};

export type ManualEntryValidationListProps = {
	items: ManualEntryValidationItem[];
};

export type ManualEntryBarcodeShareMismatch = {
	name: string;
	brandOwner: string;
	sourceLabel: string;
	message: string;
} | null;

export type BarcodeAutofillSuggestionProps = {
	name: string;
	brandOwner?: string;
	sourceLabel: string;
	heading?: string;
	description?: string;
	applyLabel?: string;
	keepLabel?: string;
	tone?: "default" | "error";
	onApply: () => void | Promise<void>;
	onKeepManual: () => void;
};

export type ManualEntryStep = {
	id: ManualEntryStepId;
	label: string;
};

export type ManualEntryStepTabsProps = {
	steps: ManualEntryStep[];
	activeStep: ManualEntryStepId;
	panelId: string;
	tabIdPrefix: string;
	onSelect: (step: ManualEntryStepId) => void;
};

export type ManualEntryVolumeOption = {
	value: ServingMeasureUnit;
	label: string;
};

export type CustomIngredientOutcomeState = {
	food: FdcFood;
	destination: SmoothieListKey;
	addedToList: boolean;
	message: string;
};

export type CustomIngredientOutcomeProps = {
	outcome: CustomIngredientOutcomeState;
	action: "move" | "undo" | null;
	onMoveToShopping: () => void | Promise<void>;
	onMoveToFridge: () => void | Promise<void>;
	onUndo: () => void | Promise<void>;
};

export type ManualEntryListMovePromptState = {
	food: FdcFood;
	source: SmoothieListKey;
	destination: SmoothieListKey;
	resolve: (confirmed: boolean) => void;
};

export type ShareStepProps = {
	normalizedName: string;
	activeCategory: string;
	summaryNutrients: ManualEntrySummaryItem[];
	optionalNutrientCount: number;
	validationItems: ManualEntryValidationItem[];
	barcodeMessage: string;
	canShareWithCatalog: boolean;
	shareUnavailableMessage: string;
	shareHelpMessage: string;
	shareWithCatalog: boolean;
	barcodeShareMismatch: ManualEntryBarcodeShareMismatch;
	validatingBarcodeShare: boolean;
	requiresCatalogEvidence: boolean;
	showOptionalProductImageUpload: boolean;
	trustedProductImage: FoodImageAsset | undefined;
	frontPhoto: File | null;
	imagePlacement: ImagePlacementValue;
	saveDestination: SmoothieListKey;
	error: string;
	lastOutcome: CustomIngredientOutcomeState | null;
	outcomeAction: "move" | "undo" | null;
	savedMessage: string;
	catalogMessage: string;
	saving: boolean;
	onShareChange: (checked: boolean) => void | Promise<void>;
	onApplyVerifiedBarcode: () => void | Promise<void>;
	onDetachBarcodeForPrivateSave: () => void;
	onFrontPhotoChange: (file: File | null) => void;
	onImagePlacementChange: (value: ImagePlacementValue) => void;
	onNutritionPhotoChange: (file: File | null) => void;
	onBarcodePhotoChange: (file: File | null) => void;
	onSaveDestinationChange: (destination: SmoothieListKey) => void;
	onMoveToShopping: () => void | Promise<void>;
	onMoveToFridge: () => void | Promise<void>;
	onUndo: () => void | Promise<void>;
	onBack: () => void;
	onSubmit: () => void | Promise<void>;
	onSaveDestinationInput?: (element: HTMLSelectElement | null) => void;
};

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

export type IdentityStepProps = {
	name: string;
	brandOwner: string;
	category: string;
	categoryOptionId: string;
	barcode: string;
	categoryWarningMessage: string;
	categorySourceValues: string[];
	barcodeMessage: string;
	barcodeValidationMessage: string;
	checkingBarcodeReference: boolean;
	barcodeSuggestion: ManualEntryBarcodeSuggestion;
	onNameChange: (value: string) => void;
	onBrandChange: (value: string) => void;
	onCategoryChange: (option: FoodCategoryPickerOption) => void;
	onCategoryStatusChange: (status: FoodCategoryPickerStatus) => void;
	onBarcodeChange: (value: string) => void;
	onBarcodeBlur: () => void | Promise<void>;
	onApplyBarcodeSuggestion: () => void | Promise<void>;
	onKeepManualBarcodeEntry: () => void;
	onNameInput?: (element: HTMLInputElement) => void;
	onNext: () => void | Promise<void>;
};

export type ServingsStepProps = {
	servingLabel: string;
	resolvedServingLabel: string;
	servingWeightGrams: number | null;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	volumeOptions: ManualEntryVolumeOption[];
	onServingLabelChange: (value: string) => void;
	onServingWeightChange: (value: number) => void;
	onUseVolumeChange: (value: boolean) => void;
	onVolumeQuantityChange: (value: number | null) => void;
	onVolumeUnitChange: (value: ServingMeasureUnit) => void;
	onBack: () => void;
	onNext: () => void;
};

export type ManualEntryNutrientFieldsProps = {
	groups: ManualEntryNutrientGroup[];
	loading?: boolean;
	error?: string;
	accordion?: boolean;
	defaultOpenFirst?: boolean;
	getValue: (field: ManualEntryNutrientDefinition) => number | null;
	onValueChange: (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => void;
	isRequired?: (field: ManualEntryNutrientDefinition) => boolean;
};

export type NutrientStepProps = {
	groups: ManualEntryNutrientGroup[];
	loading: boolean;
	error: string;
	helper: string;
	validationItems?: ManualEntryValidationItem[];
	accordion?: boolean;
	defaultOpenFirst?: boolean;
	hideUnavailableStatus?: boolean;
	labelOcrMappings?: NutritionLabelOcrMapping[];
	labelOcrMappingError?: string;
	nutritionPhoto?: File | null;
	onNutritionPhotoChange?: (file: File | null) => void;
	onApplyNutritionLabelOcr?: (payload: NutritionLabelOcrApplyPayload) => void;
	getValue: (field: ManualEntryNutrientDefinition) => number | null;
	onValueChange: (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => void;
	isRequired: (field: ManualEntryNutrientDefinition) => boolean;
	onBack: () => void;
	onNext: () => void;
};

export type ProductImageEvidenceInputProps = {
	trustedImage?: FoodImageAsset;
	frontPhoto: File | null;
	placement: ImagePlacementValue;
	required?: boolean;
	description?: string;
	onFrontPhotoChange: (file: File | null) => void;
	onPlacementChange: (value: ImagePlacementValue) => void;
};

export type NutritionLabelOcrApplyPayload = {
	candidates: NutritionLabelOcrCandidate[];
	serving: NutritionLabelServingCandidate | null;
};

export type NutritionLabelOcrRecognizer = (options: {
	file: File;
	onProgress?: (progress: NutritionLabelOcrProgress) => void;
	signal?: AbortSignal;
}) => Promise<NutritionLabelOcrRecognition>;

export type NutritionLabelOcrInputProps = {
	mappings: NutritionLabelOcrMapping[];
	photo: File | null;
	recognize?: NutritionLabelOcrRecognizer;
	onPhotoChange: (file: File | null) => void;
	onApply: (payload: NutritionLabelOcrApplyPayload) => void;
};

export const manualEntrySteps: ManualEntryStep[] = [
	{ id: "identity", label: "Identity" },
	{ id: "servings", label: "Servings" },
	{ id: "macros", label: "Macros" },
	{ id: "extended", label: "Extended" },
	{ id: "share", label: "Share" },
];

export const emptyManualEntryNutrientGroups: ManualEntryNutrientGroupsByStep = {
	macros: [],
	extended: [],
};

export const volumeAmountRequiredMessage =
	"Enter a volume amount or turn off Label includes volume.";
