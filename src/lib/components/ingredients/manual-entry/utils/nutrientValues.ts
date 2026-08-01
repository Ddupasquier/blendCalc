import type {
	ManualEntryNutrientDefinition,
	ManualEntryNutrientGroupsByStep,
} from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { FdcNutrient } from "$lib/utils/food/types";
import type {
	ManualEntrySummaryItem,
	NutrientValueState,
} from "$lib/components/ingredients/manual-entry/formTypes";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export const getManualNutrientValuesById = (values: NutrientValueState) => {
	const valuesById = new Map<number, number>();
	for (const [nutrientId, value] of Object.entries(values)) {
		const numericId = Number(nutrientId);
		if (Number.isFinite(numericId) && Number.isFinite(value)) {
			valuesById.set(numericId, value);
		}
	}
	return valuesById;
};

export const setManualNutrientState = ({
	field,
	value,
	values,
	touched,
}: {
	field: ManualEntryNutrientDefinition;
	value: string;
	values: NutrientValueState;
	touched: Record<number, true>;
}): {
	values: NutrientValueState;
	touched: Record<number, true>;
} => {
	if (value.trim() === "") {
		const { [field.nutrientId]: _removedValue, ...nextValues } = values;
		const { [field.nutrientId]: _removedTouched, ...nextTouched } = touched;
		return { values: nextValues, touched: nextTouched };
	}

	const numericValue = Number(value);
	if (!Number.isFinite(numericValue) || numericValue < 0) {
		const { [field.nutrientId]: _removedValue, ...nextValues } = values;
		const { [field.nutrientId]: _removedTouched, ...nextTouched } = touched;
		return { values: nextValues, touched: nextTouched };
	}

	return {
		values: {
			...values,
			[field.nutrientId]: numericValue,
		},
		touched: {
			...touched,
			[field.nutrientId]: true as const,
		},
	};
};

export const getManualEntryNutrientFields = (
	groups: ManualEntryNutrientGroupsByStep,
) => [
	...groups.macros.flatMap((group) => group.fields),
	...groups.extended.flatMap((group) => group.fields),
];

export const stripUnitFromNutrientLabel = (label: string) =>
	label.replace(/\s*\([^)]*\)\s*$/u, "").trim();

export const getRequiredManualEntryNutrientFields = (
	fields: ManualEntryNutrientDefinition[],
) => fields.filter((field) => field.requiredForManualEntry);

export const buildSaveNutrients = ({
	importedNutrients,
	manualEntryNutrientFields,
	manualNutrientValues,
	manualTouchedNutrientIds,
}: {
	importedNutrients: FdcNutrient[];
	manualEntryNutrientFields: ManualEntryNutrientDefinition[];
	manualNutrientValues: NutrientValueState;
	manualTouchedNutrientIds: Record<number, true>;
}) => {
	const nutrientsById = new Map<number, FdcNutrient>();

	for (const nutrient of importedNutrients) {
		const nutrientId = Number(nutrient.nutrientId);
		const value = toFiniteNonnegativeNumber(nutrient.value);
		if (
			!Number.isSafeInteger(nutrientId) ||
			nutrientId <= 0 ||
			value === null
		) continue;
		nutrientsById.set(nutrientId, {
			...nutrient,
			nutrientId,
			value,
		});
	}

	for (const field of manualEntryNutrientFields) {
		const value = manualNutrientValues[field.nutrientId] ?? null;
		const existing = nutrientsById.get(field.nutrientId);
		const wasEdited = Boolean(manualTouchedNutrientIds[field.nutrientId]);
		const shouldPersistManualValue =
			wasEdited ||
			!existing ||
			field.requiredForManualEntry ||
			(value !== null && value > 0);

		if (!shouldPersistManualValue || !Number.isFinite(value) || Number(value) < 0) continue;
		if (value <= 0 && !field.requiredForManualEntry && !wasEdited) continue;

		const keepImportedMetadata = Boolean(existing && !wasEdited);

		nutrientsById.set(field.nutrientId, {
			nutrientId: field.nutrientId,
			nutrientName: field.nutrientName,
			nutrientNumber: field.nutrientNumber,
			unitName: field.unitName,
				value,
				valueOrigin: "reported",
				valueStatus: value === 0 ? "reported-zero" : "reported",
				source: keepImportedMetadata ? existing?.source : "user-label",
			sourceReference: keepImportedMetadata
				? existing?.sourceReference
				: undefined,
				confidence: keepImportedMetadata
					? existing?.confidence
					: "user-reported",
				sourceNutrientKey: keepImportedMetadata
					? existing?.sourceNutrientKey
					: String(field.nutrientId),
				sourceNutrientCode: keepImportedMetadata
					? existing?.sourceNutrientCode
					: field.nutrientNumber,
				mappingStatus: keepImportedMetadata
					? existing?.mappingStatus
					: "canonical",
				mappingMethod: keepImportedMetadata
					? existing?.mappingMethod
					: "user-entered-canonical-field",
				mappingReviewReference: keepImportedMetadata
					? existing?.mappingReviewReference
					: undefined,
				derivationMethod: keepImportedMetadata
					? existing?.derivationMethod
					: undefined,
			});
	}

	return [...nutrientsById.values()];
};

export const getOptionalNutrientCount = (
	saveNutrients: FdcNutrient[],
	requiredFields: ManualEntryNutrientDefinition[],
) => {
	const requiredIds = new Set(requiredFields.map((field) => field.nutrientId));
	return saveNutrients.filter(
		(nutrient) => !requiredIds.has(nutrient.nutrientId),
	).length;
};

export const getSummaryItems = ({
	requiredFields,
	getValue,
}: {
	requiredFields: ManualEntryNutrientDefinition[];
	getValue: (field: ManualEntryNutrientDefinition) => number | null;
}): ManualEntrySummaryItem[] =>
	requiredFields.slice(0, 4).map((field) => ({
		label: stripUnitFromNutrientLabel(field.label),
		value: getValue(field),
		unitName: field.unitName,
	}));
