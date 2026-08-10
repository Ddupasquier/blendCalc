import {
	manualEntrySteps,
	volumeAmountRequiredMessage,
	type FoodCategoryPickerStatus,
	type StepValidationItem,
	type ManualEntryStepId,
} from "$lib/components/ingredients/manual-entry/formTypes";
import {
	getManualEntryNutrientFields,
	getManualNutrientValuesById,
	getRequiredManualEntryNutrientFields,
} from "$lib/components/ingredients/manual-entry/utils/nutrientValues";
import {
	buildManualEntryNutrientAvailabilityItems,
	buildManualEntryValidationItems,
	buildRequiredManualNutrientValidationItems,
	getAttemptedValidationItems as getAttemptedManualEntryValidationItems,
	markValidationAttemptedStep,
	warningStillApplies,
} from "$lib/components/ingredients/manual-entry/utils/validationItems";
import {
	resolveManualEntryBackStep,
	resolveManualEntryNextStep,
	resolveManualEntryStepSelection,
} from "$lib/components/ingredients/manual-entry/utils/stepNavigation";
import { getBarcodeCategoryWarningMessage } from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import { validateNutrientRelationshipRules } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type { ManualEntryFormState } from "./manualEntryFormState.svelte";
import type { ManualEntryReferenceDataController } from "./manualEntryReferenceDataController.svelte";

type ManualEntryValidationControllerOptions = {
	form: ManualEntryFormState;
	referenceData: ManualEntryReferenceDataController;
	onClose?: () => void;
};

export const createManualEntryValidationController = ({
	form,
	referenceData,
	onClose,
}: ManualEntryValidationControllerOptions) => {
	const state = $state({
		loadingCategoryOptions: true,
		categoryOptionsAvailable: false,
		categoryOptionsError: "",
		stepWarningMessage: "",
		stepWarningStep: null as ManualEntryStepId | null,
	});
	let stepWarningTimer: ReturnType<typeof setTimeout> | null = null;

	const nutrientFields = $derived(
		getManualEntryNutrientFields(referenceData.state.nutrientGroups),
	);
	const requiredNutrientFields = $derived(
		getRequiredManualEntryNutrientFields(nutrientFields),
	);
	const nutrientRelationshipValidationItems = $derived<StepValidationItem[]>(
		validateNutrientRelationshipRules(
			getManualNutrientValuesById(form.data.manualNutrientValues),
			referenceData.state.nutrientRelationshipRules,
		).map((issue) => ({
			message: issue.message,
			tone: issue.severity,
			step: "macros",
		})),
	);
	const requiredNutrientValidationItems = $derived<StepValidationItem[]>(
		buildRequiredManualNutrientValidationItems({
			requiredFields: requiredNutrientFields,
			getValue: form.getNutrientValue,
		}),
	);
	const nutrientAvailabilityItems = $derived<StepValidationItem[]>(
		buildManualEntryNutrientAvailabilityItems({
			loadingManualEntryNutrients: referenceData.state.loadingNutrients,
			manualEntryNutrientError: referenceData.state.nutrientError,
			requiredFieldCount: requiredNutrientFields.length,
		}),
	);
	const normalizedName = $derived(form.data.name.trim());
	const categoryWarningMessage = $derived(
		getBarcodeCategoryWarningMessage({
			barcode: form.data.barcode,
			sourceDraft: form.data.barcodeReferenceSourceDraft,
			selectedCategory: form.data.category,
		}),
	);
	const validationItems = $derived<StepValidationItem[]>(
		buildManualEntryValidationItems({
			normalizedName,
			servingWeightGrams: form.data.servingWeightGrams,
			useVolumeEquivalent: form.data.useVolumeEquivalent,
			volumeQuantity: form.data.volumeQuantity,
			volumeAmountRequiredMessage,
			activeCategory: form.data.category,
			activeCategoryOptionId: form.data.categoryOptionId,
			loadingCategoryOptions: state.loadingCategoryOptions,
			categoryOptionsError: state.categoryOptionsError,
			categoryOptionsAvailable: state.categoryOptionsAvailable,
			loadingNutrientRelationshipRules:
				referenceData.state.loadingNutrientRelationshipRules,
			nutrientRelationshipRuleError:
				referenceData.state.nutrientRelationshipRuleError,
			manualEntryNutrientAvailabilityItems: nutrientAvailabilityItems,
			requiredManualNutrientValidationItems:
				requiredNutrientValidationItems,
			nutrientRelationshipValidationItems,
		}),
	);
	const blockingValidation = $derived(
		validationItems.find((item) => item.tone === "error") ?? null,
	);
	const hideMacroUnavailableStatus = $derived(
		Boolean(referenceData.state.nutrientError) ||
			(!referenceData.state.loadingNutrients &&
				!referenceData.state.nutrientError &&
				requiredNutrientFields.length === 0),
	);

	const handleCategoryPickerStatus = (status: FoodCategoryPickerStatus) => {
		state.loadingCategoryOptions = status.loading;
		state.categoryOptionsAvailable = status.hasOptions;
		state.categoryOptionsError = status.error;
	};

	const getAttemptedValidationItems = (items: StepValidationItem[]) =>
		getAttemptedManualEntryValidationItems({
			items,
			attemptedSteps: form.data.validationAttemptedSteps,
			stepWarningStep: state.stepWarningStep,
			stepWarningMessage: state.stepWarningMessage,
		});

	const markValidationAttempted = (step: ManualEntryStepId) => {
		form.data.validationAttemptedSteps = markValidationAttemptedStep({
			attemptedSteps: form.data.validationAttemptedSteps,
			step,
		});
	};

	const clearStepWarning = () => {
		state.stepWarningMessage = "";
		state.stepWarningStep = null;
		if (!stepWarningTimer) return;
		clearTimeout(stepWarningTimer);
		stepWarningTimer = null;
	};

	const showStepWarning = (message: string, step: ManualEntryStepId) => {
		clearStepWarning();
		state.stepWarningMessage = message;
		state.stepWarningStep = step;
		stepWarningTimer = setTimeout(() => {
			state.stepWarningMessage = "";
			state.stepWarningStep = null;
			stepWarningTimer = null;
		}, 3200);
	};

	const showNavigationStepWarning = (
		message: string,
		step: ManualEntryStepId,
	) => {
		if (
			step === "identity" &&
			!form.data.categoryOptionId &&
			categoryWarningMessage
		) {
			clearStepWarning();
			return;
		}
		showStepWarning(message, step);
	};

	const applyNavigationResult = (
		result: ReturnType<typeof resolveManualEntryNextStep>,
	) => {
		form.data.validationAttemptedSteps = result.attemptedSteps;
		form.data.activeStep = result.activeStep;
		if (result.warning) {
			showNavigationStepWarning(result.warning.message, result.warning.step);
			return false;
		}
		clearStepWarning();
		return true;
	};

	const goToStep = async (
		step: string,
		beforeIdentityLeave?: () => void | Promise<void>,
	) => {
		if (form.data.activeStep === "identity" && beforeIdentityLeave) {
			await beforeIdentityLeave();
		}
		const result = resolveManualEntryStepSelection({
			steps: manualEntrySteps,
			activeStep: form.data.activeStep,
			targetStep: step as ManualEntryStepId,
			attemptedSteps: form.data.validationAttemptedSteps,
			validationItems,
		});
		if (!result) return false;
		return applyNavigationResult(result);
	};

	const goNext = async (
		beforeIdentityLeave?: () => void | Promise<void>,
	) => {
		if (form.data.activeStep === "identity" && beforeIdentityLeave) {
			await beforeIdentityLeave();
		}
		return applyNavigationResult(
			resolveManualEntryNextStep({
				steps: manualEntrySteps,
				activeStep: form.data.activeStep,
				attemptedSteps: form.data.validationAttemptedSteps,
				validationItems,
			}),
		);
	};

	const goBack = () => {
		clearStepWarning();
		const result = resolveManualEntryBackStep({
			steps: manualEntrySteps,
			activeStep: form.data.activeStep,
			attemptedSteps: form.data.validationAttemptedSteps,
		});
		form.data.validationAttemptedSteps = result.attemptedSteps;
		form.data.activeStep = result.activeStep;
		if (result.close) onClose?.();
	};

	const destroy = () => {
		clearStepWarning();
	};

	$effect(() => {
		if (!state.stepWarningMessage || !state.stepWarningStep) return;
		if (
			!warningStillApplies({
				items: validationItems,
				stepWarningStep: state.stepWarningStep,
				stepWarningMessage: state.stepWarningMessage,
			})
		) {
			clearStepWarning();
		}
	});

	return {
		state,
		get nutrientFields() {
			return nutrientFields;
		},
		get requiredNutrientFields() {
			return requiredNutrientFields;
		},
		get normalizedName() {
			return normalizedName;
		},
		get categoryWarningMessage() {
			return categoryWarningMessage;
		},
		get validationItems() {
			return validationItems;
		},
		get blockingValidation() {
			return blockingValidation;
		},
		get hideMacroUnavailableStatus() {
			return hideMacroUnavailableStatus;
		},
		handleCategoryPickerStatus,
		getAttemptedValidationItems,
		markValidationAttempted,
		clearStepWarning,
		showNavigationStepWarning,
		goToStep,
		goNext,
		goBack,
		destroy,
	};
};

export type ManualEntryValidationController = ReturnType<
	typeof createManualEntryValidationController
>;
