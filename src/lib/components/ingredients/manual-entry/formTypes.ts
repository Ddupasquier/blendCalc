import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { FdcFood } from "$lib/utils/food/types";
import type { ManualEntryNutrientGroupsByStep } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type {
	NutritionLabelOcrCandidate,
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
	value: number | null;
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

export type ManualEntryBarcodeShareMismatch = {
	name: string;
	brandOwner: string;
	sourceLabel: string;
	message: string;
} | null;

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
	destination: IngredientListKey;
	addedToList: boolean;
	message: string;
};

export type ManualEntryListMovePromptState = {
	food: FdcFood;
	source: IngredientListKey;
	destination: IngredientListKey;
	resolve: (confirmed: boolean) => void;
};

export type NutritionLabelOcrApplyPayload = {
	candidates: NutritionLabelOcrCandidate[];
	serving: NutritionLabelServingCandidate | null;
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
