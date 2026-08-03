import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { NutrientValueState } from "$lib/components/ingredients/manual-entry/formTypes";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type {
	FdcFood,
	FdcNutrient,
	FoodFieldProvenance,
	FoodImageAsset,
	FoodBarcodeProvenance,
	FoodIdentityType,
	FoodIngredientAnalysis,
	FoodPackageQuantity,
	FoodSourceRecordMetadata,
	FoodStructuredIngredient,
	FoodServing,
} from "$lib/utils/food/types";
import { buildSaveNutrients } from "$lib/components/ingredients/manual-entry/utils/nutrientValues";

export type ManualEntryCustomFoodPayload = {
	name: string;
	nameProvenance: NonNullable<FdcFood["nameProvenance"]>;
	brandOwner: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	serving?: FoodServing;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	barcode: string | null;
	barcodeSource: FdcFood["barcodeSource"];
	barcodeProvenance?: FoodBarcodeProvenance;
	sourceKey?: string;
	sourceLabel?: string;
	sourceDataType?: string;
	sourcePublishedDate?: string;
	sourceModifiedDate?: string;
	foodIdentityType: FoodIdentityType;
	ingredients: string;
	ingredientList: string[];
	structuredIngredients: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	additives: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	packageQuantity?: FoodPackageQuantity;
	sourceMetadata?: FoodSourceRecordMetadata;
	activeCategory: string;
	categoryOptionId: string;
	categorySymbolKey: string;
	categories: string[];
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	reportedNutrientIds: number[];
	hasSourceServing?: boolean;
	importedNutrients: FdcNutrient[];
	manualEntryNutrientFields: ManualEntryNutrientDefinition[];
	manualNutrientValues: NutrientValueState;
	manualTouchedNutrientIds: Record<number, true>;
	customFood: boolean;
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
	if (
		payload.servingWeightGrams === null ||
		!Number.isFinite(payload.servingWeightGrams) ||
		payload.servingWeightGrams <= 0
	) {
		throw new TypeError("Serving weight is required before saving an ingredient.");
	}
	const saveNutrients = buildManualEntrySaveNutrients(payload);
	const fieldProvenance = payload.customFood
		? Object.fromEntries(
				Object.entries(payload.fieldProvenance ?? {}).filter(
					([, provenance]) => provenance?.source === "user-label",
				),
			)
		: payload.fieldProvenance;

	return createCustomFood({
		name: payload.name,
		nameProvenance: payload.nameProvenance,
		brandOwner: payload.brandOwner,
		servingLabel: payload.servingLabel,
		servingWeightGrams: payload.servingWeightGrams,
		serving: payload.serving,
		volumeQuantity: payload.useVolumeEquivalent
			? payload.volumeQuantity ?? undefined
			: undefined,
		volumeUnit: payload.useVolumeEquivalent ? payload.volumeUnit : undefined,
		barcode: payload.barcode ?? undefined,
		barcodeSource: payload.barcode ? payload.barcodeSource : undefined,
		barcodeProvenance: payload.barcode ? payload.barcodeProvenance : undefined,
		sourceKey: payload.barcode ? payload.sourceKey : undefined,
		sourceLabel: payload.barcode ? payload.sourceLabel : undefined,
		sourceDataType: payload.barcode ? payload.sourceDataType : undefined,
		sourcePublishedDate: payload.barcode
			? payload.sourcePublishedDate
			: undefined,
		sourceModifiedDate: payload.barcode
			? payload.sourceModifiedDate
			: undefined,
		foodIdentityType: payload.customFood
			? "private-custom"
			: payload.foodIdentityType,
		ingredients: payload.ingredients,
		ingredientList: payload.ingredientList,
		structuredIngredients: payload.structuredIngredients,
		ingredientAnalysis: payload.ingredientAnalysis,
		additives: payload.additives,
		allergens: payload.allergens,
		traces: payload.traces,
		dietaryTags: payload.dietaryTags,
		labels: payload.labels,
		packageQuantity: payload.packageQuantity,
		sourceMetadata:
			payload.barcode && !payload.customFood
				? payload.sourceMetadata
				: undefined,
			categories: buildManualEntrySaveCategories(payload),
			categoryOptionId: payload.categoryOptionId,
		symbolKey: payload.categorySymbolKey,
		image: payload.image,
		fieldProvenance:
			Object.keys(fieldProvenance ?? {}).length > 0
				? fieldProvenance
				: undefined,
		nutrients: saveNutrients,
		reportedNutrientIds: [
			...new Set([
				...payload.reportedNutrientIds,
				...saveNutrients.map((nutrient) => nutrient.nutrientId),
			]),
		],
		hasSourceServing: payload.hasSourceServing === true,
		customFood: payload.customFood,
	});
};
