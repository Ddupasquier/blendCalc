import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import type { NutrientValueState } from "$lib/components/ingredients/manual-entry/formTypes";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type {
	FoodItem,
	FoodNutrient,
	FoodNutrientQualitativeFact,
	FoodNutrientSourceReview,
	FoodFieldProvenance,
	FoodImageAsset,
	FoodBarcodeProvenance,
	FoodIdentityType,
	FoodIngredientAnalysis,
	FoodPackageQuantity,
	FoodSourceRecordMetadata,
	FoodStructuredIngredient,
	FoodServing,
	FoodAlcoholByVolume,
	FoodRegulatoryDisclosure,
} from "$lib/utils/food/types";
import { buildSaveNutrients } from "$lib/components/ingredients/manual-entry/utils/nutrientValues";

export type ManualEntryCustomFoodPayload = {
	name: string;
	nameProvenance: NonNullable<FoodItem["nameProvenance"]>;
	brandOwner: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	serving?: FoodServing;
	useServingMeasure: boolean;
	servingMeasureQuantity: number | null;
	servingMeasureUnit: ServingMeasureUnit;
	barcode: string | null;
	barcodeSource: FoodItem["barcodeSource"];
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
	alcoholByVolume?: FoodAlcoholByVolume;
	regulatoryDisclosure?: FoodRegulatoryDisclosure;
	sourceMetadata?: FoodSourceRecordMetadata;
	activeCategory: string;
	categoryOptionId: string;
	categorySymbolKey: string;
	categories: string[];
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	reportedNutrientIds: number[];
	nutrientQualitativeFacts: FoodNutrientQualitativeFact[];
	nutrientSourceReview?: FoodNutrientSourceReview[];
	hasSourceServing?: boolean;
	importedNutrients: FoodNutrient[];
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
	const hasServingWeight =
		Number.isFinite(payload.servingWeightGrams) &&
		Number(payload.servingWeightGrams) > 0;
	const hasServingMeasure =
		payload.useServingMeasure &&
		Number.isFinite(payload.servingMeasureQuantity) &&
		Number(payload.servingMeasureQuantity) > 0 &&
		Boolean(payload.servingMeasureUnit);
	if (!hasServingWeight && !hasServingMeasure) {
		throw new TypeError(
			"Add an exact serving weight or the package's serving amount and unit before saving.",
		);
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
		servingWeightGrams: hasServingWeight
			? Number(payload.servingWeightGrams)
			: null,
		serving: payload.serving,
		servingMeasureQuantity: hasServingMeasure
			? (payload.servingMeasureQuantity ?? undefined)
			: undefined,
		servingMeasureUnit: hasServingMeasure
			? payload.servingMeasureUnit
			: undefined,
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
		alcoholByVolume: payload.alcoholByVolume,
		regulatoryDisclosure: payload.regulatoryDisclosure,
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
		nutrientQualitativeFacts: payload.nutrientQualitativeFacts,
		nutrientSourceReview: payload.nutrientSourceReview,
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
