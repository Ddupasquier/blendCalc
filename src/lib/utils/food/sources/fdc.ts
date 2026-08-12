import type {
	FoodItem,
	FoodIdentityType,
	FoodNutrient,
	FoodServing,
} from "$lib/utils/food/types";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import {
	INGREDIENT_SEARCH_PAGE_SIZE,
	type IngredientSearchPage,
	type IngredientSearchPageOptions,
} from "$lib/utils/ingredients/ingredientSearchPagination";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";
import { parseSourceServingMeasure } from "$lib/utils/serving/servingAmount";

type FdcDetailNutrient = {
	amount?: number;
	nutrient?: {
		id?: number;
		name?: string;
		number?: string;
		unitName?: string;
	};
};

type FdcDetailPortion = {
	amount?: number;
	gramWeight?: number;
	modifier?: string;
	portionDescription?: string;
	sequenceNumber?: number;
	measureUnit?: {
		name?: string;
		abbreviation?: string;
	};
};

type FdcSearchMeasure = {
	amount?: number;
	disseminationText?: string;
	gramWeight?: number;
	measureUnitName?: string;
	modifier?: string;
	rank?: number;
};

type FdcFoodResponse = Omit<FoodItem, "foodNutrients"> & {
	foodNutrients?: Array<FoodNutrient | FdcDetailNutrient>;
	foodPortions?: FdcDetailPortion[];
	foodMeasures?: FdcSearchMeasure[];
	ndbNumber?: number | string;
	brandName?: string;
	subbrandName?: string;
};

const normalizeLegacyUsdaNdbNumber = (value: number | string | undefined) => {
	const digits = String(value ?? "").replace(/\D/g, "");
	return digits ? digits.padStart(5, "0") : null;
};

export const FDC_CONFIGURATION_MESSAGE =
	"Food search is temporarily unavailable.";

export class FdcConfigurationError extends Error {
	constructor(message = FDC_CONFIGURATION_MESSAGE) {
		super(message);
		this.name = "FdcConfigurationError";
	}
}

const normalizeFoodNutrient = (
	nutrient: FoodNutrient | FdcDetailNutrient,
): FoodNutrient | null => {
	if ("nutrientId" in nutrient) {
		const nutrientId = Number(nutrient.nutrientId);
		const nutrientName = nutrient.nutrientName?.trim();
		const unitName = nutrient.unitName?.trim();
		const value = toFiniteNonnegativeNumber(nutrient.value);
		if (
			!Number.isSafeInteger(nutrientId) ||
			nutrientId <= 0 ||
			!nutrientName ||
			!unitName ||
			value === null
		) return null;
			return {
			nutrientId,
			nutrientName,
			nutrientNumber: String(nutrient.nutrientNumber ?? ""),
			unitName,
				value,
				valueOrigin: nutrient.valueOrigin ?? "reported",
				valueStatus: nutrient.valueStatus ??
					(value === 0 ? "reported-zero" : "reported"),
				standardError: nutrient.standardError,
				sourceNutrientKey:
					nutrient.sourceNutrientKey ?? String(nutrientId),
				sourceNutrientCode:
					nutrient.sourceNutrientCode ??
					(String(nutrient.nutrientNumber ?? "") || undefined),
				mappingStatus: nutrient.mappingStatus ?? "canonical",
				mappingMethod: nutrient.mappingMethod ?? "source-identifier",
				mappingReviewReference: nutrient.mappingReviewReference,
				derivationMethod: nutrient.derivationMethod,
			};
	}

	const definition = nutrient.nutrient;
	const nutrientId = Number(definition?.id);
	const nutrientName = definition?.name?.trim();
	const unitName = definition?.unitName?.trim();
	const value = toFiniteNonnegativeNumber(nutrient.amount);
	if (
		!Number.isSafeInteger(nutrientId) ||
		nutrientId <= 0 ||
		!nutrientName ||
		!unitName ||
		value === null
	) return null;
		return {
		nutrientId,
		nutrientName,
		nutrientNumber: String(definition?.number ?? ""),
		unitName,
			value,
			valueOrigin: "reported",
			valueStatus: value === 0 ? "reported-zero" : "reported",
			sourceNutrientKey: String(nutrientId),
			sourceNutrientCode: String(definition?.number ?? "") || undefined,
			mappingStatus: "canonical",
			mappingMethod: "source-identifier",
		};
};

const toPositiveNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
};

const getDetailPortionLabel = (portion: FdcDetailPortion) =>
	portion.portionDescription?.trim() ||
	portion.modifier?.trim() ||
	[
		toPositiveNumber(portion.amount),
		portion.measureUnit?.abbreviation?.trim() ||
			portion.measureUnit?.name?.trim(),
	].filter(Boolean).join(" ");

const getSearchMeasureLabel = (measure: FdcSearchMeasure) =>
	measure.disseminationText?.trim() ||
	measure.modifier?.trim() ||
	[
		toPositiveNumber(measure.amount),
		measure.measureUnitName?.trim(),
	].filter(Boolean).join(" ");

const getFdcFoodIdentityType = (food: FdcFoodResponse): FoodIdentityType => {
	if (food.foodIdentityType) return food.foodIdentityType;
	const dataType = food.dataType?.trim().toLocaleLowerCase("en-US");
	if (dataType === "branded") return "packaged";
	if (
		dataType === "foundation" ||
		dataType === "sr legacy" ||
		dataType === "survey (fndds)" ||
		dataType === "experimental"
	) {
		return "generic";
	}
	if (
		food.barcode ||
		food.gtinUpc ||
		food.brandOwner?.trim() ||
		food.brandName?.trim()
	) {
		return "packaged";
	}
	return "unknown";
};

const getFdcServingOrigin = (food: FdcFoodResponse): FoodServing["origin"] => {
	const identityType = getFdcFoodIdentityType(food);
	if (identityType === "packaged") return "package-label";
	if (identityType === "generic") return "source-household-measure";
	return "unknown";
};

const normalizeFoodServings = (
	food: FdcFoodResponse,
): FoodServing[] => {
	const sourceReference = String(food.fdcId);
	const origin = getFdcServingOrigin(food);
	const rows = [
		...(food.foodPortions ?? []).flatMap((portion) => {
			const label = getDetailPortionLabel(portion);
			const gramWeight = toPositiveNumber(portion.gramWeight);
			const amount = toPositiveNumber(portion.amount);
			const sourceUnit = portion.measureUnit?.abbreviation?.trim() ||
				portion.measureUnit?.name?.trim();
			const parsedMeasure = amount !== null && sourceUnit
				? parseSourceServingMeasure(`${amount} ${sourceUnit}`)
				: null;
			return label && gramWeight !== null
				? [{
					label,
					gramWeight,
					amount,
					unitKey: parsedMeasure?.unit,
					measureType: portion.measureUnit?.name?.trim() || "Food portion",
					isHouseholdMeasure: true,
					sourceMeasureKey: portion.sequenceNumber === undefined
						? undefined
						: `portion:${portion.sequenceNumber}`,
					origin,
					gramWeightMethod: "source-reported" as const,
					order: toPositiveNumber(portion.sequenceNumber),
				}]
				: [];
		}),
		...(food.foodMeasures ?? []).flatMap((measure) => {
			const label = getSearchMeasureLabel(measure);
			const gramWeight = toPositiveNumber(measure.gramWeight);
			const amount = toPositiveNumber(measure.amount);
			const sourceUnit = measure.measureUnitName?.trim();
			const parsedMeasure = amount !== null && sourceUnit
				? parseSourceServingMeasure(`${amount} ${sourceUnit}`)
				: null;
			return label && gramWeight !== null
				? [{
					label,
					gramWeight,
					amount,
					unitKey: parsedMeasure?.unit,
					measureType: measure.measureUnitName?.trim() || "Food measure",
					isHouseholdMeasure: true,
					sourceMeasureKey: measure.rank === undefined
						? undefined
						: `measure:${measure.rank}`,
					origin,
					gramWeightMethod: "source-reported" as const,
					order: toPositiveNumber(measure.rank),
				}]
				: [];
		}),
	];
	const seen = new Set<string>();
	return rows.flatMap((serving, index) => {
		const key = `${serving.label.toLocaleLowerCase("en-US")}:${serving.gramWeight}`;
		if (seen.has(key)) return [];
		seen.add(key);
		return [{
			label: serving.label,
			gramWeight: serving.gramWeight,
				amount: serving.amount ?? undefined,
				unitKey: serving.unitKey,
				isPrimary: serving.order === 1 || (index === 0 && !rows.some(
				(candidate) => candidate.order === 1,
			)),
			source: "usda" as const,
				sourceReference,
				confidence: "unknown" as const,
				measureType: serving.measureType,
				isHouseholdMeasure: serving.isHouseholdMeasure,
				sourceMeasureKey: serving.sourceMeasureKey,
				origin: serving.origin,
				gramWeightMethod: serving.gramWeightMethod,
			}];
	});
};

const toSourceTimestamp = (value: string | undefined) => {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	const dateParts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (dateParts) {
		const month = Number(dateParts[1]);
		const day = Number(dateParts[2]);
		const year = Number(dateParts[3]);
		const date = new Date(Date.UTC(year, month - 1, day));
		if (
			date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
		) {
			return date.toISOString();
		}
		return undefined;
	}
	const timestamp = Date.parse(trimmed);
	return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
};

const normalizeSourceRecordMetadata = (food: FdcFoodResponse) => {
	const marketCountries = [
		...(food.sourceMetadata?.marketCountries ?? []),
		food.marketCountry?.trim(),
	].filter((value): value is string => Boolean(value));
	const uniqueMarketCountries = [...new Set(marketCountries)];
	const metadata = {
		...food.sourceMetadata,
		...(food.sourceMetadata?.publishedAt
			? {}
			: {
				publishedAt: toSourceTimestamp(
					food.publishedDate ?? food.publicationDate,
				),
			}),
		...(food.sourceMetadata?.availableAt
			? {}
			: { availableAt: toSourceTimestamp(food.availableDate) }),
		...(food.sourceMetadata?.modifiedAt
			? {}
			: { modifiedAt: toSourceTimestamp(food.modifiedDate) }),
		...(food.sourceMetadata?.discontinuedAt
			? {}
			: { discontinuedAt: toSourceTimestamp(food.discontinuedDate) }),
		...(uniqueMarketCountries.length > 0
			? { marketCountries: uniqueMarketCountries }
			: {}),
	};
	return Object.values(metadata).some((value) => value !== undefined)
		? metadata
		: undefined;
};

export const normalizeFdcFood = (food: FdcFoodResponse): FoodItem => {
	const foodNutrients = (food.foodNutrients ?? []).flatMap((nutrient) => {
		const normalized = normalizeFoodNutrient(nutrient);
		return normalized ? [normalized] : [];
	});
	const legacyUsdaNdbNumber = normalizeLegacyUsdaNdbNumber(food.ndbNumber);
	const foodServings = normalizeFoodServings(food);
	const packageLabel = food.packageWeight?.trim();
	const brandOwner = food.brandOwner?.trim() || food.brandName?.trim();
	const sourceMetadata = normalizeSourceRecordMetadata(food);
	const sourceReference = String(food.fdcId);
	const hasCategory = Boolean(
		food.foodCategory?.trim() ||
		food.brandedFoodCategory?.trim() ||
		food.categories?.some((category) => category.trim()),
	);
	const hasSourceMetadata = Boolean(
		food.scientificName?.trim() ||
		food.alternateDescription?.trim() ||
		food.preparation?.trim() ||
		sourceMetadata,
	);
	return {
		...food,
		description: formatSourceProductName(food.description),
		sourceIdentifiers: {
			...food.sourceIdentifiers,
			usdaFdcId: String(food.fdcId),
			...(legacyUsdaNdbNumber
				? { usdaNdbNumber: legacyUsdaNdbNumber }
				: {}),
		},
		nameProvenance: "source",
		brandOwner: brandOwner || undefined,
		foodIdentityType: getFdcFoodIdentityType(food),
		foodNutrients,
		reportedNutrientIds: foodNutrients.map((nutrient) => nutrient.nutrientId),
		foodServings,
		hasSourceServing: foodServings.length > 0,
		packageQuantity:
			food.packageQuantity ?? (packageLabel ? { label: packageLabel } : undefined),
		sourceMetadata,
		fieldProvenance: {
			...food.fieldProvenance,
			productName: food.fieldProvenance?.productName ?? {
				source: "usda",
				sourceReference,
				confidence: "imported",
			},
			...(brandOwner
				? {
						brandOwner: food.fieldProvenance?.brandOwner ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
			...(foodNutrients.length > 0
				? {
						nutrition: food.fieldProvenance?.nutrition ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
			...(hasCategory
				? {
						categories: food.fieldProvenance?.categories ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
			...(foodServings.length > 0
				? {
						serving: food.fieldProvenance?.serving ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
			...(hasSourceMetadata
				? {
						sourceMetadata: food.fieldProvenance?.sourceMetadata ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
			...(food.scientificName?.trim()
				? {
						scientificName: food.fieldProvenance?.scientificName ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
			...(food.alternateDescription?.trim()
				? {
						alternateDescription:
							food.fieldProvenance?.alternateDescription ?? {
								source: "usda" as const,
								sourceReference,
								confidence: "imported" as const,
							},
					}
				: {}),
			...(food.preparation?.trim()
				? {
						preparation: food.fieldProvenance?.preparation ?? {
							source: "usda" as const,
							sourceReference,
							confidence: "imported" as const,
						},
					}
				: {}),
		},
	};
};

export const searchFoodPage = async (
	query: string,
	options: IngredientSearchPageOptions = {},
): Promise<IngredientSearchPage> => {
	const trimmed = query.trim();
	if (!trimmed) {
		return { foods: [], hasMore: false, nextOffset: null, total: 0 };
	}
	const offset = options.offset ?? 0;
	const limit = options.limit ?? INGREDIENT_SEARCH_PAGE_SIZE;
	const searchParams = new URLSearchParams({
		q: trimmed,
		offset: String(offset),
		limit: String(limit),
		source: options.sourceFilter ?? "all",
		trust: options.trustFilter ?? "any",
	});

	const response = await fetch(
		`/api/foods/search?${searchParams.toString()}`,
		{ headers: { accept: "application/json" } },
	);
	if (!response.ok) {
		throw new FdcConfigurationError();
	}
	const data = await response.json() as Partial<IngredientSearchPage>;
	const foods = data.foods ?? [];
	const nextOffset = typeof data.nextOffset === "number" &&
		Number.isInteger(data.nextOffset)
		? data.nextOffset
		: null;
	const total = typeof data.total === "number" && Number.isInteger(data.total)
		? data.total
		: foods.length;
	return {
		foods,
		hasMore: data.hasMore === true,
		nextOffset,
		total,
	};
};
