import type { ServingMeasureUnit } from "../../../../../defaults/servingMeasureDefaults";
import type { NutrientValueState } from "$lib/components/ingredients/manual-entry/formTypes";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { FdcFood, FdcNutrient, FoodImageAsset } from "$lib/utils/food/types";
import { buildSaveNutrients } from "$lib/components/ingredients/manual-entry/utils/nutrientValues";

export type ManualEntryCustomFoodPayload = {
	name: string;
	brandOwner: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	barcode: string | null;
	barcodeSource: FdcFood["barcodeSource"];
	ingredients: string;
	ingredientList: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	activeCategory: string;
	categories: string[];
	image?: FoodImageAsset;
	reportedNutrientIds: number[];
	importedNutrients: FdcNutrient[];
	manualEntryNutrientFields: ManualEntryNutrientDefinition[];
	manualNutrientValues: NutrientValueState;
	manualTouchedNutrientIds: Record<number, true>;
};

export const buildManualEntrySaveNutrients = ({
	importedNutrients,
	manualEntryNutrientFields,
	manualNutrientValues,
	manualTouchedNutrientIds,
}: Pick<
	ManualEntryCustomFoodPayload,
	| "importedNutrients"
	| "manualEntryNutrientFields"
	| "manualNutrientValues"
	| "manualTouchedNutrientIds"
>) =>
	buildSaveNutrients({
		importedNutrients,
		manualEntryNutrientFields,
		manualNutrientValues,
		manualTouchedNutrientIds,
	});

export const buildManualEntrySaveCategories = ({
	activeCategory,
	categories,
}: Pick<ManualEntryCustomFoodPayload, "activeCategory" | "categories">) =>
	[
		activeCategory,
		...categories.filter((item) => item !== activeCategory),
	].filter(Boolean);

export const createManualEntryCustomFood = (
	payload: ManualEntryCustomFoodPayload,
) => {
	const saveNutrients = buildManualEntrySaveNutrients(payload);

	return createCustomFood({
		name: payload.name,
		brandOwner: payload.brandOwner,
		servingLabel: payload.servingLabel,
		servingWeightGrams: payload.servingWeightGrams ?? 0,
		volumeQuantity: payload.useVolumeEquivalent
			? payload.volumeQuantity ?? undefined
			: undefined,
		volumeUnit: payload.useVolumeEquivalent ? payload.volumeUnit : undefined,
		barcode: payload.barcode ?? undefined,
		barcodeSource: payload.barcode ? payload.barcodeSource : undefined,
		ingredients: payload.ingredients,
		ingredientList: payload.ingredientList,
		allergens: payload.allergens,
		traces: payload.traces,
		dietaryTags: payload.dietaryTags,
		labels: payload.labels,
		categories: buildManualEntrySaveCategories(payload),
		image: payload.image,
		nutrients: saveNutrients,
		reportedNutrientIds: [
			...new Set([
				...payload.reportedNutrientIds,
				...saveNutrients.map((nutrient) => nutrient.nutrientId),
			]),
		],
	});
};
