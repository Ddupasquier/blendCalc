import type {
	ManualEntryStep,
	ManualEntryStepId,
	StepValidationItem,
} from "$lib/components/ingredients/manual-entry/formTypes";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";
import { stripUnitFromNutrientLabel } from "$lib/components/ingredients/manual-entry/utils/nutrientValues";

export type ValidationAttemptState = Partial<Record<ManualEntryStepId, boolean>>;

export const buildRequiredManualNutrientValidationItems = ({
	requiredFields,
	getValue,
}: {
	requiredFields: ManualEntryNutrientDefinition[];
	getValue: (field: ManualEntryNutrientDefinition) => number | null;
}): StepValidationItem[] =>
	requiredFields
		.filter((field) => {
			const value = getValue(field);
			return value === null || !Number.isFinite(value);
		})
		.map((field) => ({
			message: `${stripUnitFromNutrientLabel(field.label)} is required`,
			tone: "error",
			step: field.step,
		}));

export const buildManualEntryNutrientAvailabilityItems = ({
	loadingManualEntryNutrients,
	manualEntryNutrientError,
	requiredFieldCount,
}: {
	loadingManualEntryNutrients: boolean;
	manualEntryNutrientError: string;
	requiredFieldCount: number;
}): StepValidationItem[] =>
	[
		loadingManualEntryNutrients
			? {
					message: "Nutrient fields are still loading. Try again in a moment.",
					tone: "error",
					step: "macros",
					showImmediately: true,
				}
			: null,
		manualEntryNutrientError
			? {
					message: manualEntryNutrientError,
					tone: "error",
					step: "macros",
					showImmediately: true,
				}
			: null,
		!loadingManualEntryNutrients &&
		!manualEntryNutrientError &&
		requiredFieldCount === 0
			? {
					message:
						"Required nutrient fields are unavailable. Try again after nutrient metadata loads.",
					tone: "error",
					step: "macros",
					showImmediately: true,
				}
			: null,
	].filter(Boolean) as StepValidationItem[];

export const buildManualEntryValidationItems = ({
	normalizedName,
	servingWeightGrams,
	useVolumeEquivalent,
	volumeQuantity,
	volumeAmountRequiredMessage,
	activeCategory,
	loadingCategoryOptions,
	categoryOptionsError,
	visibleCategoryOptions,
	loadingNutrientRelationshipRules,
	nutrientRelationshipRuleError,
	manualEntryNutrientAvailabilityItems,
	requiredManualNutrientValidationItems,
	nutrientRelationshipValidationItems,
}: {
	normalizedName: string;
	servingWeightGrams: number | null;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeAmountRequiredMessage: string;
	activeCategory: string;
	loadingCategoryOptions: boolean;
	categoryOptionsError: string;
	visibleCategoryOptions: string[];
	loadingNutrientRelationshipRules: boolean;
	nutrientRelationshipRuleError: string;
	manualEntryNutrientAvailabilityItems: StepValidationItem[];
	requiredManualNutrientValidationItems: StepValidationItem[];
	nutrientRelationshipValidationItems: StepValidationItem[];
}): StepValidationItem[] =>
	[
		normalizedName.length < 3
			? {
					message: "Name must be at least 3 characters",
					tone: "error",
					step: "identity",
				}
			: null,
		!Number.isFinite(servingWeightGrams) || (servingWeightGrams ?? 0) <= 0
			? {
					message: "Serving weight is required",
					tone: "error",
					step: "servings",
				}
			: null,
		useVolumeEquivalent &&
		(volumeQuantity === null ||
			!Number.isFinite(volumeQuantity) ||
			volumeQuantity <= 0)
			? {
					message: volumeAmountRequiredMessage,
					tone: "error",
					step: "servings",
				}
			: null,
		!activeCategory
			? {
					message: loadingCategoryOptions
						? "Food categories are still loading. Try again in a moment."
						: categoryOptionsError || visibleCategoryOptions.length === 0
							? "Food categories are unavailable. Try again after categories finish syncing."
							: "Please select a category for this ingredient.",
					tone: "error",
					step: "identity",
				}
			: null,
		loadingNutrientRelationshipRules
			? {
					message:
						"Nutrition validation rules are still loading. Try again in a moment.",
					tone: "error",
					step: "macros",
					showImmediately: true,
				}
			: null,
		nutrientRelationshipRuleError
			? {
					message: nutrientRelationshipRuleError,
					tone: "error",
					step: "macros",
					showImmediately: true,
				}
			: null,
		...manualEntryNutrientAvailabilityItems,
		...requiredManualNutrientValidationItems,
		...nutrientRelationshipValidationItems,
	].filter(Boolean) as StepValidationItem[];

export const getVisibleValidationItems = ({
	items,
	stepWarningStep,
	stepWarningMessage,
}: {
	items: StepValidationItem[];
	stepWarningStep: ManualEntryStepId | null;
	stepWarningMessage: string;
}) =>
	items.filter(
		(item) =>
			!(
				stepWarningStep === item.step &&
				stepWarningMessage &&
				item.message === stepWarningMessage
			),
	);

export const getAttemptedValidationItems = ({
	items,
	attemptedSteps,
	stepWarningStep,
	stepWarningMessage,
}: {
	items: StepValidationItem[];
	attemptedSteps: ValidationAttemptState;
	stepWarningStep: ManualEntryStepId | null;
	stepWarningMessage: string;
}) =>
	getVisibleValidationItems({
		items,
		stepWarningStep,
		stepWarningMessage,
	}).filter((item) => item.showImmediately || attemptedSteps[item.step]);

export const markValidationAttemptedThroughStep = ({
	steps,
	attemptedSteps,
	targetStep,
}: {
	steps: ManualEntryStep[];
	attemptedSteps: ValidationAttemptState;
	targetStep: ManualEntryStepId;
}) => {
	const targetIndex = steps.findIndex((step) => step.id === targetStep);
	const nextAttemptedSteps = { ...attemptedSteps };

	for (const step of steps.slice(0, Math.max(0, targetIndex))) {
		nextAttemptedSteps[step.id] = true;
	}

	return nextAttemptedSteps;
};

export const markAllValidationAttempted = (steps: ManualEntryStep[]) =>
	Object.fromEntries(steps.map((step) => [step.id, true])) as ValidationAttemptState;

export const getFirstBlockingValidationThroughStep = ({
	steps,
	items,
	targetStep,
}: {
	steps: ManualEntryStep[];
	items: StepValidationItem[];
	targetStep: ManualEntryStepId;
}) => {
	const targetIndex = steps.findIndex((step) => step.id === targetStep);
	const stepsToValidate = new Set(
		steps.slice(0, Math.max(0, targetIndex)).map((step) => step.id),
	);

	return (
		items.find((item) => item.tone === "error" && stepsToValidate.has(item.step)) ??
		null
	);
};

export const warningStillApplies = ({
	items,
	stepWarningStep,
	stepWarningMessage,
}: {
	items: StepValidationItem[];
	stepWarningStep: ManualEntryStepId | null;
	stepWarningMessage: string;
}) =>
	Boolean(
		stepWarningMessage &&
			stepWarningStep &&
			items.some(
				(item) =>
					item.step === stepWarningStep && item.message === stepWarningMessage,
			),
	);
