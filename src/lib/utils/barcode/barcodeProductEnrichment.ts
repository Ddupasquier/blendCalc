import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type {
	FdcNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodImageAsset,
	FoodIngredientAnalysis,
	FoodTrackedField,
} from "$lib/utils/food/types";

export type MissingBarcodeProductFields = Record<FoodTrackedField, boolean>;

export type BarcodeProductSupplementPlan = MissingBarcodeProductFields & {
	ingredientList: boolean;
	missingNutrientIds: number[];
};

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

const hasValues = (values?: string[]) =>
	Boolean(values?.some((value) => value.trim()));

const hasStructuredIngredients = (draft: BarcodeProductDraft) =>
	Boolean(draft.structuredIngredients?.length);

const hasIngredientAnalysis = (
	analysis: FoodIngredientAnalysis | undefined,
) => Boolean(
	analysis &&
	(
		hasValues(analysis.ingredientTags) ||
		hasValues(analysis.analysisTags) ||
		hasValues(analysis.derivedTraceTags) ||
		analysis.percentAnalysis !== undefined ||
		analysis.percentEstimate !== undefined ||
		analysis.percentKnown !== undefined ||
		analysis.percentUnknown !== undefined
	),
);

const hasPrecautionaryStatements = (draft: BarcodeProductDraft) =>
	Boolean(
		draft.precautionaryStatements?.some((statement) =>
			statement.text.trim() && statement.allergens.some((allergen) => allergen.trim())
		),
	);

const hasObservedField = (
	draft: BarcodeProductDraft,
	field: Extract<
		FoodTrackedField,
		"allergens" | "traces" | "dietaryTags" | "labels"
	>,
	values?: string[],
) => Boolean(draft.fieldProvenance?.[field]) || hasValues(values);

export const getMissingBarcodeProductFields = (
	draft: BarcodeProductDraft,
): MissingBarcodeProductFields => ({
	nutrition: !hasNutrition(draft),
	image: !hasImage(draft),
	categories: !hasCategories(draft),
	serving: !hasServing(draft),
	ingredients:
		!draft.ingredients?.trim() || !hasValues(draft.ingredientList),
	allergens: !hasObservedField(draft, "allergens", draft.allergens),
	traces: !hasObservedField(draft, "traces", draft.traces),
	precautionaryStatements:
		!draft.fieldProvenance?.precautionaryStatements &&
		!hasPrecautionaryStatements(draft),
	dietaryTags: !hasObservedField(draft, "dietaryTags", draft.dietaryTags),
	labels: !hasObservedField(draft, "labels", draft.labels),
	structuredIngredients: !hasStructuredIngredients(draft),
	ingredientAnalysis: !hasIngredientAnalysis(draft.ingredientAnalysis),
	additives: !hasValues(draft.additives),
	package: !draft.packageQuantity,
	sourceMetadata: !draft.sourceMetadata,
});

export const getBarcodeProductSupplementPlan = (
	draft: BarcodeProductDraft,
	requiredNutrientIds: Iterable<number> = [],
): BarcodeProductSupplementPlan => {
	const availableIds = new Set(
		draft.nutrients.filter(isValidNutrient).map((nutrient) => nutrient.nutrientId),
	);
	return {
		...getMissingBarcodeProductFields(draft),
		ingredientList: !hasValues(draft.ingredientList),
		missingNutrientIds: [...requiredNutrientIds].filter(
			(nutrientId) => !availableIds.has(nutrientId),
		),
	};
};

export const needsBarcodeProductSupplement = (
	draft: BarcodeProductDraft,
	requiredNutrientIds: Iterable<number> = [],
) => {
	const plan = getBarcodeProductSupplementPlan(draft, requiredNutrientIds);
	return plan.missingNutrientIds.length > 0 ||
		Object.entries(plan).some(
			([field, missing]) => field !== "missingNutrientIds" && missing === true,
		);
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
		Boolean(
			supplement.fieldProvenance?.[field] ||
				(field === "image" && supplement.image?.source) ||
				(field === "nutrition" && supplement.nutrients.some((item) => item.source)),
		) &&
			(field === "nutrition"
				? addsNutrition
				: missing[field] && !supplementMissing[field])
	);
};

const inferFieldSource = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
): FoodFieldSource | undefined => {
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

	return undefined;
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
) => {
	const source = getFieldSource(draft, field);
	return source
		? {
				...provenance,
				[field]: source,
			}
		: provenance;
};

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
	const useSupplementIngredients = supplementedFields.has("ingredients");
	const useSupplementAllergens = supplementedFields.has("allergens");
	const useSupplementTraces = supplementedFields.has("traces");
	const useSupplementPrecautionaryStatements =
		supplementedFields.has("precautionaryStatements");
	const useSupplementDietaryTags = supplementedFields.has("dietaryTags");
	const useSupplementLabels = supplementedFields.has("labels");
	const useSupplementStructuredIngredients =
		supplementedFields.has("structuredIngredients");
	const useSupplementIngredientAnalysis =
		supplementedFields.has("ingredientAnalysis");
	const useSupplementAdditives = supplementedFields.has("additives");
	const useSupplementPackage = supplementedFields.has("package");
	const useSupplementSourceMetadata = supplementedFields.has("sourceMetadata");
	if (
		!useSupplementServing &&
		!useSupplementNutrition &&
		!useSupplementImage &&
		!useSupplementCategories &&
		!useSupplementIngredients &&
		!useSupplementAllergens &&
		!useSupplementTraces &&
		!useSupplementPrecautionaryStatements &&
		!useSupplementDietaryTags &&
		!useSupplementLabels &&
		!useSupplementStructuredIngredients &&
		!useSupplementIngredientAnalysis &&
		!useSupplementAdditives &&
		!useSupplementPackage &&
		!useSupplementSourceMetadata
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
	if (useSupplementIngredients) {
		provenance = withFieldSource(provenance, "ingredients", supplement);
	}
	if (useSupplementAllergens) {
		provenance = withFieldSource(provenance, "allergens", supplement);
	}
	if (useSupplementTraces) {
		provenance = withFieldSource(provenance, "traces", supplement);
	}
	if (useSupplementPrecautionaryStatements) {
		provenance = withFieldSource(
			provenance,
			"precautionaryStatements",
			supplement,
		);
	}
	if (useSupplementDietaryTags) {
		provenance = withFieldSource(provenance, "dietaryTags", supplement);
	}
	if (useSupplementLabels) {
		provenance = withFieldSource(provenance, "labels", supplement);
	}
	if (useSupplementStructuredIngredients) {
		provenance = withFieldSource(provenance, "structuredIngredients", supplement);
	}
	if (useSupplementIngredientAnalysis) {
		provenance = withFieldSource(provenance, "ingredientAnalysis", supplement);
	}
	if (useSupplementAdditives) {
		provenance = withFieldSource(provenance, "additives", supplement);
	}
	if (useSupplementPackage) {
		provenance = withFieldSource(provenance, "package", supplement);
	}
	if (useSupplementSourceMetadata) {
		provenance = withFieldSource(provenance, "sourceMetadata", supplement);
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
		serving: useSupplementServing
			? supplement.serving
			: primary.serving,
		volumeEquivalent: useSupplementServing
			? supplement.volumeEquivalent
			: primary.volumeEquivalent,
		nutrients,
		reportedNutrientIds,
			ingredients: useSupplementIngredients
				? supplement.ingredients
				: primary.ingredients,
			ingredientList: useSupplementIngredients
				? supplement.ingredientList
				: primary.ingredientList,
			allergens: useSupplementAllergens
				? supplement.allergens
				: primary.allergens,
			traces: useSupplementTraces ? supplement.traces : primary.traces,
			precautionaryStatements: useSupplementPrecautionaryStatements
				? supplement.precautionaryStatements
				: primary.precautionaryStatements,
			dietaryTags: useSupplementDietaryTags
				? supplement.dietaryTags
				: primary.dietaryTags,
			labels: useSupplementLabels ? supplement.labels : primary.labels,
			structuredIngredients: useSupplementStructuredIngredients
				? supplement.structuredIngredients
				: primary.structuredIngredients,
			ingredientAnalysis: useSupplementIngredientAnalysis
				? supplement.ingredientAnalysis
				: primary.ingredientAnalysis,
			additives: useSupplementAdditives
				? supplement.additives
				: primary.additives,
			packageQuantity:
				primary.packageQuantity ?? supplement.packageQuantity,
			sourceMetadata: primary.sourceMetadata ?? supplement.sourceMetadata,
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
