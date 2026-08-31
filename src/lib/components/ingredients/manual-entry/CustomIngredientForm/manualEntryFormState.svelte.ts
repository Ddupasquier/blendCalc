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

	const restore = (
		savedData: Partial<ReturnType<typeof getManualEntryFormResetState>>,
	) => {
		Object.assign(data, getManualEntryFormResetState(), savedData, {
			checkingBarcodeReference: false,
			validatingBarcodeShare: false,
			frontPhoto: null,
			nutritionPhoto: null,
			barcodePhoto: null,
		});
	};

	const markFieldAsUserEntered = (field: FoodTrackedField) => {
		data.fieldProvenance = {
			...data.fieldProvenance,
			[field]: {
				source: "user-label",
				confidence: "user-reported",
			},
		};
		if (field === "serving") {
			data.usesInternal100GramBasis = false;
			data.serving = {
				label: data.servingLabel.trim() || "Serving",
				gramWeight: data.servingWeightGrams ?? undefined,
				amount: data.useServingMeasure
					? (data.servingMeasureQuantity ?? undefined)
					: undefined,
				unitKey: data.useServingMeasure ? data.servingMeasureUnit : undefined,
				isPrimary: true,
				measureType: "User serving",
				isHouseholdMeasure: data.useServingMeasure,
				origin: "user-entered",
				gramWeightMethod: "user-reported",
				source: "user-label",
				confidence: "user-reported",
			};
		}
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
		{ candidates, qualitativeFacts, serving }: NutritionLabelOcrApplyPayload,
		nutrientFields: ManualEntryNutrientDefinition[],
	) => {
		if (serving) {
			data.servingWeightGrams = serving.gramWeight;
			data.servingLabel = serving.label;
			markFieldAsUserEntered("serving");
		}
		for (const candidate of candidates) {
			const field = nutrientFields.find(
				(item) => item.nutrientId === candidate.nutrientId,
			);
			if (!field) continue;
			setNutrientValue(field, String(candidate.value));
		}
		const selectedNutrientIds = new Set(
			qualitativeFacts.map((fact) => fact.nutrientId),
		);
		data.nutrientQualitativeFacts = [
			...data.nutrientQualitativeFacts.filter(
				(fact) => !selectedNutrientIds.has(fact.nutrientId),
			),
			...qualitativeFacts.map((fact) => ({
				...fact,
				measurementBasis: data.servingWeightGrams
					? ({
							kind: "mass",
							quantity: data.servingWeightGrams,
							unitKey: "g",
						} as const)
					: ({
							kind: "serving",
							quantity: 1,
							unitKey: "serving",
							servingLabel: data.servingLabel.trim() || "Package serving",
						} as const),
				source: "user-label" as const,
				confidence: "user-reported" as const,
				mappingStatus: "canonical" as const,
				mappingMethod: "reviewed-label-alias",
				policyKey: "us-fda-nutrition-facts",
				policyReference: "https://www.fda.gov/media/134505/download",
			})),
		];
	};

	const getSaveNutrients = (nutrientFields: ManualEntryNutrientDefinition[]) =>
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
		getOptionalNutrientCount(getSaveNutrients(nutrientFields), requiredFields);

	const getSummaryNutrients = (
		requiredFields: ManualEntryNutrientDefinition[],
	) =>
		getSummaryItems({
			requiredFields,
			getValue: getNutrientValue,
		});

	const getResolvedServingLabel = () =>
		data.usesInternal100GramBasis
			? "100g nutrition basis"
			: buildCustomServingLabel({
					servingLabel: data.servingLabel,
					servingWeightGrams: data.servingWeightGrams,
					servingMeasureQuantity: data.useServingMeasure
						? (data.servingMeasureQuantity ?? undefined)
						: undefined,
					servingMeasureUnit: data.useServingMeasure
						? data.servingMeasureUnit
						: undefined,
				});

	return {
		data,
		reset,
		restore,
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
