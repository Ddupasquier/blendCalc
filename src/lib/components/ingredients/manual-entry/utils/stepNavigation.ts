import type {
	ManualEntryStep,
	ManualEntryStepId,
	StepValidationItem,
} from "$lib/components/ingredients/manual-entry/formTypes";
import {
	getFirstBlockingValidationThroughStep,
	resolveForwardValidationAttemptState,
	type ValidationAttemptState,
} from "$lib/components/ingredients/manual-entry/utils/validationItems";

export type ManualEntryStepNavigationResult = {
	activeStep: ManualEntryStepId;
	attemptedSteps: ValidationAttemptState;
	warning: StepValidationItem | null;
	close?: boolean;
};

const getStepIndex = (steps: ManualEntryStep[], stepId: ManualEntryStepId) =>
	steps.findIndex((step) => step.id === stepId);

export const resolveManualEntryStepSelection = ({
	steps,
	activeStep,
	targetStep,
	attemptedSteps,
	validationItems,
}: {
	steps: ManualEntryStep[];
	activeStep: ManualEntryStepId;
	targetStep: ManualEntryStepId;
	attemptedSteps: ValidationAttemptState;
	validationItems: StepValidationItem[];
}): ManualEntryStepNavigationResult | null => {
	const targetIndex = getStepIndex(steps, targetStep);
	if (targetIndex < 0) return null;

	const activeStepIndex = getStepIndex(steps, activeStep);
	if (targetIndex <= activeStepIndex) {
		return {
			activeStep: targetStep,
			attemptedSteps,
			warning: null,
		};
	}

	const warning = getFirstBlockingValidationThroughStep({
		steps,
		items: validationItems,
		targetStep,
	});
	const nextAttemptedSteps = resolveForwardValidationAttemptState({
		steps,
		attemptedSteps,
		targetStep,
		warning,
	});

	return {
		activeStep: warning?.step ?? targetStep,
		attemptedSteps: nextAttemptedSteps,
		warning,
	};
};

export const resolveManualEntryNextStep = ({
	steps,
	activeStep,
	attemptedSteps,
	validationItems,
}: {
	steps: ManualEntryStep[];
	activeStep: ManualEntryStepId;
	attemptedSteps: ValidationAttemptState;
	validationItems: StepValidationItem[];
}): ManualEntryStepNavigationResult => {
	const activeStepIndex = Math.max(0, getStepIndex(steps, activeStep));
	const targetStep = steps[activeStepIndex + 1]?.id ?? activeStep;
	const warning = getFirstBlockingValidationThroughStep({
		steps,
		items: validationItems,
		targetStep,
	});
	const nextAttemptedSteps = resolveForwardValidationAttemptState({
		steps,
		attemptedSteps,
		targetStep,
		warning,
	});

	return {
		activeStep: warning?.step ?? targetStep,
		attemptedSteps: nextAttemptedSteps,
		warning,
	};
};

export const resolveManualEntryBackStep = ({
	steps,
	activeStep,
	attemptedSteps,
}: {
	steps: ManualEntryStep[];
	activeStep: ManualEntryStepId;
	attemptedSteps: ValidationAttemptState;
}): ManualEntryStepNavigationResult => {
	const activeStepIndex = Math.max(0, getStepIndex(steps, activeStep));
	const previousStep = steps[activeStepIndex - 1];
	if (!previousStep) {
		return {
			activeStep,
			attemptedSteps,
			warning: null,
			close: true,
		};
	}

	return {
		activeStep: previousStep.id,
		attemptedSteps,
		warning: null,
	};
};
