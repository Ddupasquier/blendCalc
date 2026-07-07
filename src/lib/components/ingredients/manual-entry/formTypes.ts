import type { ManualEntryValidationItem } from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
import type { ManualEntryNutrientGroupsByStep } from "$lib/utils/food/nutrients/nutrientDefinitions";

export type ManualEntryStepId =
	| "identity"
	| "servings"
	| "macros"
	| "extended"
	| "share";

export type NutrientValueState = Record<number, number>;

export type StepValidationItem = ManualEntryValidationItem & {
	step: ManualEntryStepId;
	showImmediately?: boolean;
};

export type ManualEntrySummaryItem = {
	label: string;
	value: number;
	unitName: string;
};

export type ManualEntryStep = {
	id: ManualEntryStepId;
	label: string;
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
