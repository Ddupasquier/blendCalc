import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { FdcFood } from "$lib/utils/food/types";
import type { ManualEntryNutrientGroupsByStep } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

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

export type BarcodeAutofillSuggestionProps = {
	name: string;
	brandOwner?: string;
	sourceLabel: string;
	onApply: () => void | Promise<void>;
	onKeepManual: () => void;
};

export type ManualEntryStep = {
	id: ManualEntryStepId;
	label: string;
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
