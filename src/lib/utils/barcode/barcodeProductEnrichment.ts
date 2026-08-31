import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type {
	FoodNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodImageAsset,
	FoodIngredientAnalysis,
	FoodNutrientQualitativeFact,
	FoodTrackedField,
} from "$lib/utils/food/types";
import {
	type NutrientRelationshipRule,
	validateNutrientRelationshipRules,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";

export type MissingBarcodeProductFields = Record<FoodTrackedField, boolean>;

export type BarcodeProductSupplementPlan = MissingBarcodeProductFields & {
	ingredientList: boolean;
	missingNutrientIds: number[];
};

export type ProductSourceFieldPath =
	"productIdentity" | FoodTrackedField | `nutrient:${number}`;

const PRODUCT_SOURCE_COVERAGE_FIELDS: readonly FoodTrackedField[] = [
	"productName",
	"brandOwner",
	"nutrition",
	"image",
	"categories",
	"serving",
	"ingredients",
	"allergens",
	"traces",
	"precautionaryStatements",
	"dietaryTags",
	"labels",
	"structuredIngredients",
	"ingredientAnalysis",
	"additives",
	"package",
	"alcoholByVolume",
	"regulatoryDisclosure",
	"sourceMetadata",
];

const isValidNutrient = (nutrient: FoodNutrient) =>
	Number.isSafeInteger(nutrient.nutrientId) &&
	nutrient.nutrientId > 0 &&
	Number.isFinite(nutrient.value) &&
	nutrient.value >= 0;

const hasNutrition = (draft: BarcodeProductDraft) =>
	draft.nutrients.some(isValidNutrient) ||
	Boolean(draft.nutrientQualitativeFacts?.length);

const hasImage = (draft: BarcodeProductDraft) => Boolean(draft.image?.imageUrl);

const hasCategories = (draft: BarcodeProductDraft) =>
	Boolean(
		draft.resolvedCategory ||
		draft.categoryResolution ||
		draft.categories?.some((category) => category.trim()),
	);

const hasServing = (draft: BarcodeProductDraft) =>
	draft.hasSourceServing === true &&
	Boolean(
		(Number.isFinite(draft.servingWeightGrams) &&
			Number(draft.servingWeightGrams) > 0) ||
		draft.serving?.milliliterVolume ||
		(draft.serving?.amount && draft.serving?.unitKey),
	);

const hasValues = (values?: string[]) =>
	Boolean(values?.some((value) => value.trim()));

const hasStructuredIngredients = (draft: BarcodeProductDraft) =>
	Boolean(draft.structuredIngredients?.length);

const hasIngredientAnalysis = (analysis: FoodIngredientAnalysis | undefined) =>
	Boolean(
		analysis &&
		(hasValues(analysis.ingredientTags) ||
			hasValues(analysis.analysisTags) ||
			hasValues(analysis.derivedTraceTags) ||
			analysis.percentAnalysis !== undefined ||
			analysis.percentEstimate !== undefined ||
			analysis.percentKnown !== undefined ||
			analysis.percentUnknown !== undefined),
	);

const hasPrecautionaryStatements = (draft: BarcodeProductDraft) =>
	Boolean(
		draft.precautionaryStatements?.some(
			(statement) =>
				statement.text.trim() &&
				statement.allergens.some((allergen) => allergen.trim()),
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
	productName: !draft.name.trim(),
	brandOwner: !draft.brandOwner.trim(),
	nutrition: !hasNutrition(draft),
	image: !hasImage(draft),
	categories: !hasCategories(draft),
	serving: !hasServing(draft),
	ingredients: !draft.ingredients?.trim() || !hasValues(draft.ingredientList),
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
	alcoholByVolume: !draft.alcoholByVolume,
	regulatoryDisclosure: !draft.regulatoryDisclosure,
	sourceMetadata: !draft.sourceMetadata,
});

export const getBarcodeProductSupplementPlan = (
	draft: BarcodeProductDraft,
	requiredNutrientIds: Iterable<number> = [],
): BarcodeProductSupplementPlan => {
	const availableIds = new Set([
		...draft.nutrients
			.filter(isValidNutrient)
			.map((nutrient) => nutrient.nutrientId),
		...(draft.nutrientQualitativeFacts ?? []).map((fact) => fact.nutrientId),
	]);
	return {
		...getMissingBarcodeProductFields(draft),
		ingredientList: !hasValues(draft.ingredientList),
		missingNutrientIds: [...requiredNutrientIds].filter(
			(nutrientId) => !availableIds.has(nutrientId),
		),
	};
};

export const getBarcodeProductDesiredSourceFieldPaths = (
	requiredNutrientIds: Iterable<number> = [],
): ProductSourceFieldPath[] => [
	"productIdentity",
	...PRODUCT_SOURCE_COVERAGE_FIELDS,
	...[...requiredNutrientIds].map(
		(nutrientId): ProductSourceFieldPath => `nutrient:${nutrientId}`,
	),
];

export const getBarcodeProductSupplementSourceFieldPaths = (
	draft: BarcodeProductDraft,
	requiredNutrientIds: Iterable<number> = [],
): ProductSourceFieldPath[] => {
	const plan = getBarcodeProductSupplementPlan(draft, requiredNutrientIds);
	return [
		...(
			Object.entries(plan) as Array<
				[keyof BarcodeProductSupplementPlan, boolean | number[]]
			>
		)
			.filter(
				(entry): entry is [FoodTrackedField, true] =>
					entry[0] !== "missingNutrientIds" &&
					entry[0] !== "ingredientList" &&
					entry[1] === true,
			)
			.map(([field]) => field),
		...plan.missingNutrientIds.map(
			(nutrientId): ProductSourceFieldPath => `nutrient:${nutrientId}`,
		),
	];
};

export const barcodeProductDraftReportsSourceField = (
	draft: BarcodeProductDraft,
	fieldPath: ProductSourceFieldPath,
) => {
	if (fieldPath === "productIdentity") return Boolean(draft.name.trim());
	if (fieldPath.startsWith("nutrient:")) {
		const nutrientId = Number(fieldPath.slice("nutrient:".length));
		return (
			draft.nutrients.some(
				(nutrient) =>
					nutrient.nutrientId === nutrientId && isValidNutrient(nutrient),
			) ||
			Boolean(
				draft.nutrientQualitativeFacts?.some(
					(fact) => fact.nutrientId === nutrientId,
				),
			)
		);
	}
	return !getMissingBarcodeProductFields(draft)[fieldPath as FoodTrackedField];
};

export const needsBarcodeProductSupplement = (
	draft: BarcodeProductDraft,
	requiredNutrientIds: Iterable<number> = [],
) => {
	const plan = getBarcodeProductSupplementPlan(draft, requiredNutrientIds);
	return (
		plan.missingNutrientIds.length > 0 ||
		Object.entries(plan).some(
			([field, missing]) =>
				field !== "missingNutrientIds" &&
				field !== "alcoholByVolume" &&
				field !== "regulatoryDisclosure" &&
				missing === true,
		)
	);
};

export const needsAlcoholBarcodeProductSupplement = (
	draft: BarcodeProductDraft,
	regulatedAlcoholProfileKeys: Iterable<string> = [],
) => {
	const confirmedAlcoholContext =
		(Number.isFinite(draft.alcoholByVolume?.percent) &&
			(draft.alcoholByVolume?.percent ?? 0) > 0) ||
		(Boolean(draft.regulatoryDisclosure?.profileKey) &&
			new Set(regulatedAlcoholProfileKeys).has(
				draft.regulatoryDisclosure?.profileKey ?? "",
			));
	if (!confirmedAlcoholContext) return false;

	const missing = getMissingBarcodeProductFields(draft);
	return (
		missing.brandOwner ||
		missing.package ||
		missing.alcoholByVolume ||
		missing.regulatoryDisclosure ||
		missing.sourceMetadata
	);
};

export const getSupplementedBarcodeProductFields = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft | null | undefined,
	nutrientRelationshipRules: readonly NutrientRelationshipRule[] = [],
): FoodTrackedField[] => {
	if (!supplement) return [];
	const missing = getMissingBarcodeProductFields(primary);
	const supplementMissing = getMissingBarcodeProductFields(supplement);
	const primaryNutrientIds = new Set(
		primary.nutrients
			.filter(isValidNutrient)
			.map((nutrient) => nutrient.nutrientId),
	);
	const addsNutrition =
		(supplement.nutrients.some(
			(nutrient) =>
				isValidNutrient(nutrient) &&
				!primaryNutrientIds.has(nutrient.nutrientId),
		) ||
			Boolean(
				supplement.nutrientQualitativeFacts?.some(
					(fact) =>
						!primaryNutrientIds.has(fact.nutrientId) &&
						!primary.nutrientQualitativeFacts?.some(
							(existing) => existing.nutrientId === fact.nutrientId,
						),
				),
			)) &&
		canAddSupplementNutrientsWithoutConflict(
			primary,
			supplement,
			nutrientRelationshipRules,
		);
	return (Object.keys(missing) as FoodTrackedField[]).filter(
		(field) =>
			Boolean(
				supplement.fieldProvenance?.[field] ||
				(field === "image" && supplement.image?.source) ||
				(field === "nutrition" &&
					(supplement.nutrients.some((item) => item.source) ||
						supplement.nutrientQualitativeFacts?.some((item) => item.source))),
			) &&
			(field === "nutrition"
				? addsNutrition
				: missing[field] && !supplementMissing[field]),
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
		const qualitativeFact = draft.nutrientQualitativeFacts?.find(
			(item) => item.source,
		);
		if (qualitativeFact) {
			return {
				source: qualitativeFact.source,
				sourceReference: qualitativeFact.sourceReference,
				confidence: qualitativeFact.confidence,
			};
		}
	}

	return undefined;
};

const getFieldSource = (draft: BarcodeProductDraft, field: FoodTrackedField) =>
	draft.fieldProvenance?.[field] ?? inferFieldSource(draft, field);

const scaleNutrients = (
	nutrients: FoodNutrient[],
	fromGrams: number | null,
	toGrams: number | null,
	targetServingLabel: string,
): FoodNutrient[] => {
	const validNutrients = nutrients.filter(isValidNutrient);
	if (
		!Number.isFinite(fromGrams) ||
		Number(fromGrams) <= 0 ||
		!Number.isFinite(toGrams) ||
		Number(toGrams) <= 0
	) {
		return validNutrients.map((nutrient) => ({ ...nutrient }));
	}

	const scale = Number(toGrams) / Number(fromGrams);
	return validNutrients.map((nutrient) => ({
		...nutrient,
		value: nutrient.value * scale,
		measurementBasis: {
			kind: "serving",
			quantity: 1,
			unitKey: "serving",
			servingLabel: targetServingLabel,
		},
	}));
};

const getNutrientValueMap = (nutrients: FoodNutrient[]) =>
	new Map(
		nutrients
			.filter(isValidNutrient)
			.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
	);

const hasNutrientRelationshipConflict = (
	nutrients: FoodNutrient[],
	rules: readonly NutrientRelationshipRule[],
) =>
	rules.length > 0 &&
	validateNutrientRelationshipRules(getNutrientValueMap(nutrients), [...rules])
		.length > 0;

const getAdditiveNutrientMerge = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft,
) => {
	const targetServingWeight = hasServing(primary)
		? primary.servingWeightGrams
		: supplement.servingWeightGrams;
	const targetServingLabel = hasServing(primary)
		? primary.servingLabel
		: supplement.servingLabel;
	const primaryNutrients = scaleNutrients(
		primary.nutrients,
		primary.servingWeightGrams,
		targetServingWeight,
		targetServingLabel,
	);
	const primaryNutrientIds = new Set(
		primaryNutrients.map((nutrient) => nutrient.nutrientId),
	);
	const addedNutrients = scaleNutrients(
		supplement.nutrients,
		supplement.servingWeightGrams,
		targetServingWeight,
		targetServingLabel,
	).filter((nutrient) => !primaryNutrientIds.has(nutrient.nutrientId));

	return [...primaryNutrients, ...addedNutrients];
};

const mergeQualitativeNutrientFacts = (
	primaryFacts: readonly FoodNutrientQualitativeFact[] | undefined,
	supplementFacts: readonly FoodNutrientQualitativeFact[] | undefined,
	nutrients: readonly FoodNutrient[],
) => {
	const numericNutrientIds = new Set(
		nutrients.map((nutrient) => nutrient.nutrientId),
	);
	const factsByNutrientId = new Map<number, FoodNutrientQualitativeFact>();
	for (const fact of [...(primaryFacts ?? []), ...(supplementFacts ?? [])]) {
		if (
			numericNutrientIds.has(fact.nutrientId) ||
			factsByNutrientId.has(fact.nutrientId)
		) {
			continue;
		}
		factsByNutrientId.set(fact.nutrientId, { ...fact });
	}
	return [...factsByNutrientId.values()];
};

const canAddSupplementNutrientsWithoutConflict = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft,
	rules: readonly NutrientRelationshipRule[],
) =>
	!hasNutrientRelationshipConflict(
		getAdditiveNutrientMerge(primary, supplement),
		rules,
	);

const shouldUseCoherentSupplementNutrition = (
	primary: BarcodeProductDraft,
	supplement: BarcodeProductDraft,
	rules: readonly NutrientRelationshipRule[],
) =>
	hasNutrition(primary) &&
	hasServing(supplement) &&
	hasNutrientRelationshipConflict(
		getAdditiveNutrientMerge(primary, supplement),
		rules,
	) &&
	!hasNutrientRelationshipConflict(supplement.nutrients, rules);

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
	nutrientRelationshipRules: readonly NutrientRelationshipRule[] = [],
): BarcodeProductDraft => {
	if (!supplement) return primary;

	const useCoherentSupplementNutrition = shouldUseCoherentSupplementNutrition(
		primary,
		supplement,
		nutrientRelationshipRules,
	);
	const supplementedFields = new Set(
		getSupplementedBarcodeProductFields(
			primary,
			supplement,
			nutrientRelationshipRules,
		),
	);
	const useSupplementServing =
		supplementedFields.has("serving") || useCoherentSupplementNutrition;
	const useSupplementProductName = supplementedFields.has("productName");
	const useSupplementBrandOwner = supplementedFields.has("brandOwner");
	const useSupplementNutrition =
		supplementedFields.has("nutrition") || useCoherentSupplementNutrition;
	const useSupplementImage = supplementedFields.has("image");
	const useSupplementCategories = supplementedFields.has("categories");
	const useSupplementIngredients = supplementedFields.has("ingredients");
	const useSupplementAllergens = supplementedFields.has("allergens");
	const useSupplementTraces = supplementedFields.has("traces");
	const useSupplementPrecautionaryStatements = supplementedFields.has(
		"precautionaryStatements",
	);
	const useSupplementDietaryTags = supplementedFields.has("dietaryTags");
	const useSupplementLabels = supplementedFields.has("labels");
	const useSupplementStructuredIngredients = supplementedFields.has(
		"structuredIngredients",
	);
	const useSupplementIngredientAnalysis =
		supplementedFields.has("ingredientAnalysis");
	const useSupplementAdditives = supplementedFields.has("additives");
	const useSupplementPackage = supplementedFields.has("package");
	const useSupplementSourceMetadata = supplementedFields.has("sourceMetadata");
	const useSupplementAlcoholByVolume =
		supplementedFields.has("alcoholByVolume");
	const useSupplementRegulatoryDisclosure = supplementedFields.has(
		"regulatoryDisclosure",
	);
	if (
		!useSupplementProductName &&
		!useSupplementBrandOwner &&
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
		!useSupplementSourceMetadata &&
		!useSupplementAlcoholByVolume &&
		!useSupplementRegulatoryDisclosure
	) {
		return primary;
	}
	const nextServingWeight = useSupplementServing
		? supplement.servingWeightGrams
		: primary.servingWeightGrams;
	const nextServingLabel = useSupplementServing
		? supplement.servingLabel
		: primary.servingLabel;
	let provenance = { ...primary.fieldProvenance };
	let nutrients = scaleNutrients(
		primary.nutrients,
		primary.servingWeightGrams,
		nextServingWeight,
		nextServingLabel,
	);
	let reportedNutrientIds = [...primary.reportedNutrientIds];
	let nutrientQualitativeFacts = mergeQualitativeNutrientFacts(
		primary.nutrientQualitativeFacts,
		[],
		nutrients,
	);
	if (useSupplementProductName) {
		provenance = withFieldSource(provenance, "productName", supplement);
	}
	if (useSupplementBrandOwner) {
		provenance = withFieldSource(provenance, "brandOwner", supplement);
	}

	if (useSupplementNutrition) {
		const supplementNutrients = scaleNutrients(
			supplement.nutrients,
			supplement.servingWeightGrams,
			nextServingWeight,
			nextServingLabel,
		);
		if (useCoherentSupplementNutrition) {
			nutrients = supplementNutrients;
			nutrientQualitativeFacts = mergeQualitativeNutrientFacts(
				[],
				supplement.nutrientQualitativeFacts,
				nutrients,
			);
			reportedNutrientIds = supplement.reportedNutrientIds.filter(
				(nutrientId) =>
					nutrients.some((nutrient) => nutrient.nutrientId === nutrientId),
			);
		} else {
			const nutrientIds = new Set(
				nutrients.map((nutrient) => nutrient.nutrientId),
			);
			const addedNutrients = supplementNutrients.filter(
				(nutrient) => !nutrientIds.has(nutrient.nutrientId),
			);
			nutrients = [...nutrients, ...addedNutrients];
			nutrientQualitativeFacts = mergeQualitativeNutrientFacts(
				nutrientQualitativeFacts,
				supplement.nutrientQualitativeFacts,
				nutrients,
			);
			reportedNutrientIds = [
				...new Set([...reportedNutrientIds, ...supplement.reportedNutrientIds]),
			].filter((nutrientId) =>
				nutrients.some((nutrient) => nutrient.nutrientId === nutrientId),
			);
		}
		if (!hasNutrition(primary) || useCoherentSupplementNutrition) {
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
		provenance = withFieldSource(
			provenance,
			"structuredIngredients",
			supplement,
		);
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
	if (useSupplementAlcoholByVolume) {
		provenance = withFieldSource(provenance, "alcoholByVolume", supplement);
	}
	if (useSupplementRegulatoryDisclosure) {
		provenance = withFieldSource(
			provenance,
			"regulatoryDisclosure",
			supplement,
		);
	}

	return {
		...primary,
		name: useSupplementProductName ? supplement.name : primary.name,
		nameProvenance: useSupplementProductName
			? supplement.nameProvenance
			: primary.nameProvenance,
		brandOwner: useSupplementBrandOwner
			? supplement.brandOwner
			: primary.brandOwner,
		servingLabel: useSupplementServing
			? supplement.servingLabel
			: primary.servingLabel,
		servingWeightGrams: nextServingWeight,
		hasSourceServing: useSupplementServing
			? supplement.hasSourceServing
			: primary.hasSourceServing,
		serving: useSupplementServing ? supplement.serving : primary.serving,
		volumeEquivalent: useSupplementServing
			? supplement.volumeEquivalent
			: primary.volumeEquivalent,
		nutrients,
		nutrientQualitativeFacts,
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
		packageQuantity: primary.packageQuantity ?? supplement.packageQuantity,
		sourceMetadata: primary.sourceMetadata ?? supplement.sourceMetadata,
		alcoholByVolume: useSupplementAlcoholByVolume
			? supplement.alcoholByVolume
			: primary.alcoholByVolume,
		regulatoryDisclosure: useSupplementRegulatoryDisclosure
			? supplement.regulatoryDisclosure
			: primary.regulatoryDisclosure,
		image: useSupplementImage ? supplement.image : primary.image,
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
