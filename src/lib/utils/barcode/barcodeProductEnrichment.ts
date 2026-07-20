import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type {
	FdcNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodImageAsset,
	FoodTrackedField,
} from "$lib/utils/food/types";

export type MissingBarcodeProductFields = Record<FoodTrackedField, boolean>;

const hasNutrition = (draft: BarcodeProductDraft) =>
	draft.nutrients.length > 0 || draft.reportedNutrientIds.length > 0;

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

export const needsBarcodeProductSupplement = (draft: BarcodeProductDraft) =>
	Object.values(getMissingBarcodeProductFields(draft)).some(Boolean);

export const getSupplementedBarcodeProductFields = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft | null | undefined,
): FoodTrackedField[] => {
	if (!supplement) return [];
	const missing = getMissingBarcodeProductFields(primary);
	const supplementMissing = getMissingBarcodeProductFields(supplement);
	return (Object.keys(missing) as FoodTrackedField[]).filter(
		(field) => missing[field] && !supplementMissing[field],
	);
};

const getDefaultConfidence = (
	source: FoodFieldSource["source"],
): NonNullable<FoodFieldSource["confidence"]> => {
	if (source === "usda" || source === "open-food-facts") {
		return "source-verified";
	}
	if (source === "community-reviewed" || source === "shared-catalog") {
		return "moderator-reviewed";
	}
	if (source === "user-label") return "user-reported";
	return "imported";
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
				confidence: nutrient.confidence ?? getDefaultConfidence(nutrient.source),
			};
		}
	}

	const source = getDraftSource(draft);
	return {
		source,
		sourceReference: draft.sourceReference,
		confidence: getDefaultConfidence(source),
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
	if (
		!Number.isFinite(fromGrams) ||
		fromGrams <= 0 ||
		!Number.isFinite(toGrams) ||
		toGrams <= 0 ||
		fromGrams === toGrams
	) {
		return nutrients.map((nutrient) => ({ ...nutrient }));
	}

	const scale = toGrams / fromGrams;
	return nutrients.map((nutrient) => ({
		...nutrient,
		value: Number.isFinite(nutrient.value)
			? Math.max(0, nutrient.value * scale)
			: 0,
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
	let nutrients = primary.nutrients;
	let reportedNutrientIds = primary.reportedNutrientIds;

	if (useSupplementNutrition) {
		nutrients = scaleNutrients(
			supplement.nutrients,
			supplement.servingWeightGrams,
			nextServingWeight,
		);
		reportedNutrientIds = [...supplement.reportedNutrientIds];
		provenance = withFieldSource(provenance, "nutrition", supplement);
	} else if (useSupplementServing && hasNutrition(primary)) {
		nutrients = scaleNutrients(
			primary.nutrients,
			primary.servingWeightGrams,
			nextServingWeight,
		);
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
