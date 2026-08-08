import {
	DEFAULT_MILLILITERS_PER_VOLUME_MEASURE,
	SERVING_MEASURE_OPTIONS,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import {
	readCloudCustomFoodByBarcode,
	readCloudCustomFoodByNameKey,
	saveCloudCustomFood,
} from "$lib/utils/storage/supabase";
import { cleanBarcode, normalizeBarcode } from "$lib/utils/barcode/barcode";
import type {
	FoodItem,
	FoodNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodImageAsset,
	FoodBarcodeProvenance,
	FoodIdentityType,
	FoodIngredientAnalysis,
	FoodPackageQuantity,
	FoodPrecautionaryStatement,
	FoodSourceRecordMetadata,
	FoodStructuredIngredient,
	FoodServing,
} from "$lib/utils/food/types";
import { normalizeCustomFoodName } from "$lib/utils/food/custom/customFoodNames";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export const CUSTOM_FOODS_CHANGED_EVENT = "blendcalc-custom-foods-changed";

export type CustomFoodInput = {
	name: string;
	nameProvenance?: NonNullable<FoodItem["nameProvenance"]>;
	brandOwner?: string;
	servingLabel?: string;
	servingWeightGrams: number;
	volumeQuantity?: number;
	volumeUnit?: ServingMeasureUnit;
	barcode?: string;
	barcodeSource?: FoodItem["barcodeSource"];
	barcodeProvenance?: FoodBarcodeProvenance;
	sourceKey?: string;
	sourceLabel?: string;
	sourceDataType?: string;
	sourcePublishedDate?: string;
	sourceModifiedDate?: string;
	foodIdentityType?: FoodIdentityType;
	scientificName?: string;
	alternateDescription?: string;
	preparation?: string;
	ingredients?: string;
	ingredientList?: string[];
	structuredIngredients?: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	additives?: string[];
	allergens?: string[];
	traces?: string[];
	precautionaryStatements?: FoodPrecautionaryStatement[];
	dietaryTags?: string[];
	labels?: string[];
	packageQuantity?: FoodPackageQuantity;
	sourceMetadata?: FoodSourceRecordMetadata;
	categories?: string[];
	categoryOptionId?: string;
	symbolKey?: string;
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	nutrients: FoodNutrient[];
	reportedNutrientIds?: number[];
	hasSourceServing?: boolean;
	serving?: FoodServing;
	customFood?: boolean;
};

export type CustomFoodSaveResult =
	| "saved"
	| "duplicate-name"
	| "duplicate-barcode"
	| "error";

const dispatchCustomFoodsChanged = () => {
	window.dispatchEvent(new CustomEvent(CUSTOM_FOODS_CHANGED_EVENT));
};

const createCustomFoodId = () => {
	return -Math.floor(Date.now() * 1000 + Math.random() * 1000);
};

const getPer100GramValue = (valuePerServing: number, servingWeightGrams: number) => {
	return (valuePerServing * 100) / servingWeightGrams;
};

const createNutrients = (
	nutrients: FoodNutrient[],
	servingWeightGrams: number,
): FoodNutrient[] => {
	const seenIds = new Set<number>();
	return nutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.nutrientId);
		const nutrientValue = toFiniteNonnegativeNumber(nutrient.value);
		if (
			!Number.isSafeInteger(nutrientId) ||
			nutrientId <= 0 ||
			nutrientValue === null ||
			seenIds.has(nutrientId)
		) {
			return [];
		}
		seenIds.add(nutrientId);
		return [{
			nutrientId,
			nutrientName: nutrient.nutrientName,
			nutrientNumber: String(nutrient.nutrientNumber ?? ""),
			unitName: nutrient.unitName,
			value: getPer100GramValue(nutrientValue, servingWeightGrams),
			valueOrigin: nutrient.valueOrigin,
			source: nutrient.source,
			sourceReference: nutrient.sourceReference,
				confidence: nutrient.confidence,
				valueStatus: nutrient.valueStatus,
				standardError: nutrient.standardError,
				sourceNutrientKey: nutrient.sourceNutrientKey,
				sourceNutrientCode: nutrient.sourceNutrientCode,
				mappingStatus: nutrient.mappingStatus,
				mappingMethod: nutrient.mappingMethod,
				mappingReviewReference: nutrient.mappingReviewReference,
				derivationMethod: nutrient.derivationMethod,
			}];
	});
};

const getVolumeMilliliters = (
	quantity?: number,
	unit?: ServingMeasureUnit,
): number | null => {
	if (
		!Number.isFinite(quantity) ||
		Number(quantity) <= 0 ||
		!unit ||
		!(unit in DEFAULT_MILLILITERS_PER_VOLUME_MEASURE)
	) {
		return null;
	}

	const conversion = DEFAULT_MILLILITERS_PER_VOLUME_MEASURE[unit];
	return typeof conversion === "number" && Number.isFinite(conversion) && conversion > 0
		? Number(quantity) * conversion
		: null;
};

const formatServingNumber = (value: number) => {
	if (!Number.isFinite(value)) {
		throw new TypeError("Serving amount must be a finite number.");
	}
	return String(Number(value.toFixed(2)));
};

const getServingUnitDisplay = (unit: ServingMeasureUnit) => {
	const option = SERVING_MEASURE_OPTIONS.find((item) => item.value === unit);
	const abbreviatedLabel = option?.label.match(/\(([^)]+)\)/)?.[1];
	return abbreviatedLabel ?? option?.value ?? unit;
};

export const buildCustomServingLabel = ({
	servingLabel,
	servingWeightGrams,
	volumeQuantity,
	volumeUnit,
}: {
	servingLabel?: string;
	servingWeightGrams: number;
	volumeQuantity?: number;
	volumeUnit?: ServingMeasureUnit;
}) => {
	const trimmedLabel = servingLabel?.trim();
	if (trimmedLabel) return trimmedLabel;
	if (volumeQuantity && volumeQuantity > 0 && volumeUnit) {
		return `${formatServingNumber(volumeQuantity)} ${getServingUnitDisplay(volumeUnit)}`;
	}
	return `${formatServingNumber(servingWeightGrams)}g serving`;
};

const normalizeServingSource = (
	source: FoodFieldSource["source"] | undefined,
): FoodNutrient["source"] => {
	if (source === "shared-catalog") return "community-reviewed";
	if (source === "wikimedia-commons") return "unknown";
	return source;
};

const getDefaultSourceKey = (
	barcodeSource: FoodItem["barcodeSource"],
) => {
	if (barcodeSource === "community") return "shared-catalog";
	if (barcodeSource === "usda" || barcodeSource === "open-food-facts") {
		return barcodeSource;
	}
	return undefined;
};

export const createCustomFood = (input: CustomFoodInput): FoodItem => {
	const servingWeightGrams = Number(input.servingWeightGrams);
	if (!Number.isFinite(servingWeightGrams) || servingWeightGrams <= 0) {
		throw new TypeError("Serving weight must be a number greater than zero.");
	}
	const nameProvenance = input.nameProvenance ??
		(normalizeBarcode(input.barcode ?? "") ? "barcode" : "user");
	const description = nameProvenance === "user"
		? input.name.trim().replace(/\s+/g, " ")
		: formatSourceProductName(input.name);
	const volumeMilliliters = getVolumeMilliliters(
		input.volumeQuantity,
		input.volumeUnit,
	);
	const density =
		volumeMilliliters && volumeMilliliters > 0
			? servingWeightGrams / volumeMilliliters
			: null;

	const foodNutrients = createNutrients(input.nutrients, servingWeightGrams);
	const canonicalCategory = input.categories
		?.map((category) => category.trim())
		.find(Boolean);
	const servingLabel = buildCustomServingLabel({
		servingLabel: input.servingLabel,
		servingWeightGrams,
		volumeQuantity: input.volumeQuantity,
		volumeUnit: input.volumeUnit,
	});
	const hasSourceServing = input.hasSourceServing === true;
	const isUserServing = input.barcodeSource === "manual" || !input.barcode;
	const defaultServingSource = isUserServing ? "user-label" : "unknown";
	const servingSource = normalizeServingSource(
		input.fieldProvenance?.serving?.source,
	) ?? defaultServingSource;
	const servingConfidence = input.fieldProvenance?.serving?.confidence ??
		(isUserServing ? "user-reported" : "unknown");
	const customFood = input.customFood ?? true;
	const inputServing = input.serving;

	return {
		fdcId: createCustomFoodId(),
		description,
		nameProvenance,
		brandOwner: input.brandOwner?.trim() || undefined,
		foodCategory: canonicalCategory,
		dataType: input.sourceDataType?.trim() || (customFood ? "Custom" : "Branded"),
		foodIdentityType: input.foodIdentityType ??
			(customFood ? "private-custom" : "packaged"),
		scientificName: input.scientificName,
		alternateDescription: input.alternateDescription,
		preparation: input.preparation,
		servingSize: servingWeightGrams,
		servingSizeUnit: "g",
		hasSourceServing,
		foodServings: hasSourceServing
			? [{
				...inputServing,
				label: servingLabel,
				gramWeight: servingWeightGrams,
				amount: input.volumeQuantity ?? inputServing?.amount,
				unitKey: input.volumeUnit ?? inputServing?.unitKey,
				isPrimary: true,
				measureType: inputServing?.measureType ??
					(isUserServing ? "User serving" : undefined),
				isHouseholdMeasure: input.volumeQuantity !== undefined
					? true
					: inputServing?.isHouseholdMeasure,
				sourceMeasureKey: inputServing?.sourceMeasureKey,
				origin: inputServing?.origin ??
					(isUserServing ? "user-entered" : "unknown"),
				gramWeightMethod: inputServing?.gramWeightMethod ??
					(isUserServing ? "user-reported" : "unknown"),
				calculationBasis: inputServing?.calculationBasis,
				source: servingSource,
					sourceReference:
						input.fieldProvenance?.serving?.sourceReference ?? input.barcode,
				confidence: servingConfidence,
			}]
			: [],
		ingredients: input.ingredients?.trim() || undefined,
		ingredientList: input.ingredientList,
		structuredIngredients: input.structuredIngredients,
		ingredientAnalysis: input.ingredientAnalysis,
		additives: input.additives,
		allergens: input.allergens,
		traces: input.traces,
		precautionaryStatements: input.precautionaryStatements,
		dietaryTags: input.dietaryTags,
		labels: input.labels,
		packageQuantity: input.packageQuantity,
		sourceMetadata: input.sourceMetadata,
		categories: input.categories,
		categoryOptionId: input.categoryOptionId,
		symbolKey: input.symbolKey,
		image: input.image,
		fieldProvenance: input.fieldProvenance,
		customFood,
		barcode: input.barcode,
		barcodeSource: input.barcodeSource,
		barcodeProvenance: input.barcodeProvenance,
		sourceKey: input.sourceKey ?? getDefaultSourceKey(input.barcodeSource),
		sourceLabel: input.sourceLabel,
		sourceDataType: input.sourceDataType,
		sourcePublishedDate: input.sourcePublishedDate,
		sourceModifiedDate: input.sourceModifiedDate,
		customServingLabel: servingLabel,
		customServingWeightGrams: servingWeightGrams,
		customDensityGramsPerMilliliter: isUserServing ? density ?? undefined : undefined,
		customDensityLabel: isUserServing && density ? "User-reported serving pair" : undefined,
		customDensityVariancePercent: isUserServing && density ? 0 : undefined,
		customDensityConfidence: isUserServing && density ? "known" : undefined,
		foodNutrients,
		reportedNutrientIds: input.reportedNutrientIds
			? [...new Set(input.reportedNutrientIds)].filter((nutrientId) =>
				foodNutrients.some((nutrient) => nutrient.nutrientId === nutrientId)
			)
			: foodNutrients.map((nutrient) => nutrient.nutrientId),
	};
};

export const findCustomFoodByBarcode = async (barcode: string) => {
	const normalizedBarcode = normalizeBarcode(cleanBarcode(barcode));
	if (!normalizedBarcode) return null;
	return readCloudCustomFoodByBarcode(normalizedBarcode);
};

export const findCustomFoodByName = async (name: string) => {
	const normalizedName = normalizeCustomFoodName(name);
	if (!normalizedName) return null;
	return readCloudCustomFoodByNameKey(normalizedName);
};

export const saveCustomFood = async (
	food: FoodItem,
): Promise<CustomFoodSaveResult> => {
	const foodRecord = normalizeFoodForStorage(food);
	const cloudResult = await saveCloudCustomFood(foodRecord);
	if (cloudResult !== "saved") return cloudResult;

	dispatchCustomFoodsChanged();
	return "saved";
};
