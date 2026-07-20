import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type {
	FdcNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodImageAsset,
	FoodTrackedField,
} from "$lib/utils/food/types";

export type MissingBarcodeProductFields = Record<FoodTrackedField, boolean>;

const isValidNutrient = (nutrient: FdcNutrient) =>
	Number.isSafeInteger(nutrient.nutrientId) &&
	nutrient.nutrientId > 0 &&
	Number.isFinite(nutrient.value) &&
	nutrient.value >= 0;

const hasNutrition = (draft: BarcodeProductDraft) =>
	draft.nutrients.some(isValidNutrient);

const hasImage = (draft: BarcodeProductDraft) => Boolean(draft.image?.imageUrl);

const hasCategories = (draft: BarcodeProductDraft) => Boolean(
	draft.resolvedCategory ||
		draft.categoryResolution ||
		draft.categories?.some((category) => category.trim()),
);

const hasServing = (draft: BarcodeProductDraft) =>
	draft.hasSourceServing === true &&
	Number.isFinite(draft.servingWeightGrams) &&
	draft.servingWeightGrams > 0;

export const getMissingBarcodeProductFields = (
	draft: BarcodeProductDraft,
): MissingBarcodeProductFields => ({
	nutrition: !hasNutrition(draft),
	image: !hasImage(draft),
	categories: !hasCategories(draft),
	serving: !hasServing(draft),
});

export const needsBarcodeProductSupplement = (
	draft: BarcodeProductDraft,
	requiredNutrientIds: Iterable<number> = [],
) => {
	if (Object.values(getMissingBarcodeProductFields(draft)).some(Boolean)) return true;
	const availableIds = new Set(
		draft.nutrients.filter(isValidNutrient).map((nutrient) => nutrient.nutrientId),
	);
	return [...requiredNutrientIds].some((nutrientId) => !availableIds.has(nutrientId));
};

export const getSupplementedBarcodeProductFields = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft | null | undefined,
): FoodTrackedField[] => {
	if (!supplement) return [];
	const missing = getMissingBarcodeProductFields(primary);
	const supplementMissing = getMissingBarcodeProductFields(supplement);
	const primaryNutrientIds = new Set(
		primary.nutrients.filter(isValidNutrient).map((nutrient) => nutrient.nutrientId),
	);
	const addsNutrition = supplement.nutrients.some(
		(nutrient) => isValidNutrient(nutrient) && !primaryNutrientIds.has(nutrient.nutrientId),
	);
	return (Object.keys(missing) as FoodTrackedField[]).filter((field) =>
		field === "nutrition"
			? addsNutrition
			: missing[field] && !supplementMissing[field]
	);
};

const getDraftSource = (
	draft: BarcodeProductDraft,
): FoodFieldSource["source"] => {
	if (draft.source === "shared-catalog") {
		if (draft.sourceKey === "usda" || draft.sourceKey === "open-food-facts") {
			return draft.sourceKey;
		}
		return "shared-catalog";
	}
	return draft.source;
};

const inferFieldSource = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
): FoodFieldSource => {
	if (field === "image" && draft.image) {
		return {
			source: draft.image.source,
			sourceReference: draft.image.sourceReference,
			confidence: draft.image.confidence,
		};
	}

	if (field === "nutrition") {
		const nutrient = draft.nutrients.find((item) => item.source);
		if (nutrient?.source) {
			return {
				source: nutrient.source,
				sourceReference: nutrient.sourceReference,
				confidence: nutrient.confidence ?? "unknown",
			};
		}
	}

	const source = getDraftSource(draft);
	return {
		source,
		sourceReference: draft.sourceReference,
		confidence: "unknown",
	};
};

const getFieldSource = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
) => draft.fieldProvenance?.[field] ?? inferFieldSource(draft, field);

const scaleNutrients = (
	nutrients: FdcNutrient[],
	fromGrams: number,
	toGrams: number,
) => {
	const validNutrients = nutrients.filter(isValidNutrient);
	if (
		!Number.isFinite(fromGrams) ||
		fromGrams <= 0 ||
		!Number.isFinite(toGrams) ||
		toGrams <= 0 ||
		fromGrams === toGrams
	) {
		return validNutrients.map((nutrient) => ({ ...nutrient }));
	}

	const scale = toGrams / fromGrams;
	return validNutrients.map((nutrient) => ({
		...nutrient,
		value: nutrient.value * scale,
	}));
};

const withFieldSource = (
	provenance: FoodFieldProvenance,
	field: FoodTrackedField,
	draft: BarcodeProductDraft,
) => ({
	...provenance,
	[field]: getFieldSource(draft, field),
});

export const applyCachedImageToBarcodeDraft = (
	draft: BarcodeProductDraft,
	image: FoodImageAsset | null | undefined,
): BarcodeProductDraft => {
	if (!image?.imageUrl) return draft;
	return {
		...draft,
		image,
		fieldProvenance: {
			...draft.fieldProvenance,
			image: {
				source: image.source,
				sourceReference: image.sourceReference,
				confidence: image.confidence,
			},
		},
	};
};

export const mergeMissingBarcodeProductFields = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft | null | undefined,
): BarcodeProductDraft => {
	if (!supplement) return primary;

	const supplementedFields = new Set(
		getSupplementedBarcodeProductFields(primary, supplement),
	);
	const useSupplementServing = supplementedFields.has("serving");
	const useSupplementNutrition = supplementedFields.has("nutrition");
	const useSupplementImage = supplementedFields.has("image");
	const useSupplementCategories = supplementedFields.has("categories");
	if (
		!useSupplementServing &&
		!useSupplementNutrition &&
		!useSupplementImage &&
		!useSupplementCategories
	) {
		return primary;
	}
	const nextServingWeight = useSupplementServing
		? supplement.servingWeightGrams
		: primary.servingWeightGrams;
	let provenance = { ...primary.fieldProvenance };
	let nutrients = scaleNutrients(
		primary.nutrients,
		primary.servingWeightGrams,
		nextServingWeight,
	);
	let reportedNutrientIds = [...primary.reportedNutrientIds];

	if (useSupplementNutrition) {
		const supplementNutrients = scaleNutrients(
			supplement.nutrients,
			supplement.servingWeightGrams,
			nextServingWeight,
		);
		const nutrientIds = new Set(nutrients.map((nutrient) => nutrient.nutrientId));
		const addedNutrients = supplementNutrients.filter(
			(nutrient) => !nutrientIds.has(nutrient.nutrientId),
		);
		nutrients = [...nutrients, ...addedNutrients];
		reportedNutrientIds = [
			...new Set([...reportedNutrientIds, ...supplement.reportedNutrientIds]),
		].filter((nutrientId) =>
			nutrients.some((nutrient) => nutrient.nutrientId === nutrientId)
		);
		if (!hasNutrition(primary)) {
			provenance = withFieldSource(provenance, "nutrition", supplement);
		}
	}

	if (useSupplementServing) {
		provenance = withFieldSource(provenance, "serving", supplement);
	}
	if (useSupplementImage) {
		provenance = withFieldSource(provenance, "image", supplement);
	}
	if (useSupplementCategories) {
		provenance = withFieldSource(provenance, "categories", supplement);
	}

	return {
		...primary,
		servingLabel: useSupplementServing
			? supplement.servingLabel
			: primary.servingLabel,
		servingWeightGrams: nextServingWeight,
		hasSourceServing: useSupplementServing
			? supplement.hasSourceServing
			: primary.hasSourceServing,
		volumeEquivalent: useSupplementServing
			? supplement.volumeEquivalent
			: primary.volumeEquivalent,
		nutrients,
		reportedNutrientIds,
		image: useSupplementImage
			? supplement.image
			: primary.image,
		categories: useSupplementCategories
			? supplement.categories
			: primary.categories,
		resolvedCategory: useSupplementCategories
			? supplement.resolvedCategory
			: primary.resolvedCategory,
		categoryResolution: useSupplementCategories
			? supplement.categoryResolution
			: primary.categoryResolution,
		fieldProvenance: provenance,
	};
};
