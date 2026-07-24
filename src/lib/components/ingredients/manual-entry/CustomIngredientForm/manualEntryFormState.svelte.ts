import { buildCustomServingLabel } from "$lib/utils/food/custom/customFoods";
import type { FoodTrackedField } from "$lib/utils/food/types";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { NutritionLabelOcrApplyPayload } from "$lib/components/ingredients/manual-entry/formTypes";
import { buildManualEntrySaveNutrients } from "$lib/components/ingredients/manual-entry/utils/customFoodPayload";
import {
	getOptionalNutrientCount,
	getSummaryItems,
	setManualNutrientState,
} from "$lib/components/ingredients/manual-entry/utils/nutrientValues";
import { getManualEntryFormResetState } from "$lib/components/ingredients/manual-entry/utils/formState";

export const createManualEntryFormState = () => {
	const data = $state(getManualEntryFormResetState());

	const reset = () => {
		Object.assign(data, getManualEntryFormResetState());
	};

	const markFieldAsUserEntered = (field: FoodTrackedField) => {
		data.fieldProvenance = {
			...data.fieldProvenance,
			[field]: {
				source: "user-label",
				confidence: "user-reported",
			},
		};
	};

	const setNutrientValue = (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => {
		const nextState = setManualNutrientState({
			field,
			value,
			values: data.manualNutrientValues,
			touched: data.manualTouchedNutrientIds,
		});
		data.manualNutrientValues = nextState.values;
		data.manualTouchedNutrientIds = nextState.touched;
		markFieldAsUserEntered("nutrition");
	};

	const getNutrientValue = (field: ManualEntryNutrientDefinition) =>
		data.manualNutrientValues[field.nutrientId] ?? null;

	const applyNutritionLabelOcr = (
		{ candidates, serving }: NutritionLabelOcrApplyPayload,
		nutrientFields: ManualEntryNutrientDefinition[],
	) => {
		for (const candidate of candidates) {
			const field = nutrientFields.find(
				(item) => item.nutrientId === candidate.nutrientId,
			);
			if (!field) continue;
			setNutrientValue(field, String(candidate.value));
		}
		if (!serving) return;

		data.servingWeightGrams = serving.gramWeight;
		data.servingLabel = serving.label;
		markFieldAsUserEntered("serving");
	};

	const getSaveNutrients = (
		nutrientFields: ManualEntryNutrientDefinition[],
	) =>
		buildManualEntrySaveNutrients({
			importedNutrients: data.importedNutrients,
			manualEntryNutrientFields: nutrientFields,
			manualNutrientValues: data.manualNutrientValues,
			manualTouchedNutrientIds: data.manualTouchedNutrientIds,
		});

	const getOptionalNutrientTotal = (
		nutrientFields: ManualEntryNutrientDefinition[],
		requiredFields: ManualEntryNutrientDefinition[],
	) =>
		getOptionalNutrientCount(
			getSaveNutrients(nutrientFields),
			requiredFields,
		);

	const getSummaryNutrients = (
		requiredFields: ManualEntryNutrientDefinition[],
	) =>
		getSummaryItems({
			requiredFields,
			getValue: getNutrientValue,
		});

	const getResolvedServingLabel = () =>
		buildCustomServingLabel({
			servingLabel: data.servingLabel,
			servingWeightGrams:
				Number.isFinite(data.servingWeightGrams) &&
				(data.servingWeightGrams ?? 0) > 0
					? data.servingWeightGrams ?? 0
					: 0,
			volumeQuantity: data.useVolumeEquivalent
				? data.volumeQuantity ?? undefined
				: undefined,
			volumeUnit: data.useVolumeEquivalent ? data.volumeUnit : undefined,
		});

	return {
		data,
		reset,
		markFieldAsUserEntered,
		setNutrientValue,
		getNutrientValue,
		applyNutritionLabelOcr,
		getSaveNutrients,
		getOptionalNutrientTotal,
		getSummaryNutrients,
		getResolvedServingLabel,
	};
};

export type ManualEntryFormState = ReturnType<
	typeof createManualEntryFormState
>;
