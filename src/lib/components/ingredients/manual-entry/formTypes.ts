import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { FdcFood } from "$lib/utils/food/types";
import type { ManualEntryNutrientGroupsByStep } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
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

export type ManualEntryListMovePromptState = {
	food: FdcFood;
	source: SmoothieListKey;
	destination: SmoothieListKey;
	resolve: (confirmed: boolean) => void;
};

export type ProductImageEvidenceInputProps = {
	trustedImageUrl?: string;
	frontPhoto: File | null;
	cropX: number;
	cropY: number;
	cropZoom: number;
	required?: boolean;
	description?: string;
	onFrontPhotoChange: (file: File | null) => void;
	onCropXChange: (value: number) => void;
	onCropYChange: (value: number) => void;
	onCropZoomChange: (value: number) => void;
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
