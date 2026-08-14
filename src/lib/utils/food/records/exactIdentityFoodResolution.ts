import type {
	FoodFieldProvenance,
	FoodFieldSource,
	FoodItem,
	FoodNutrient,
	FoodProvenanceField,
	FoodSourceAttribution,
} from "$lib/utils/food/types";

export const EXACT_IDENTITY_RESOLVABLE_FIELDS: FoodProvenanceField[] = [
	"productName",
	"brandOwner",
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
	"scientificName",
	"alternateDescription",
	"preparation",
	"sourceMetadata",
];

export const FOOD_FIELD_CONFIDENCE_RANK: Record<
	NonNullable<FoodFieldSource["confidence"]>,
	number
> = {
	unknown: 0,
	imported: 1,
	"user-reported": 2,
	"source-verified": 3,
	corroborated: 4,
	"moderator-reviewed": 5,
};

const toTimestamp = (value?: string) => {
	const timestamp = value ? Date.parse(value) : Number.NaN;
	return Number.isFinite(timestamp) ? timestamp : 0;
};

export const getFoodEvidenceTimestamp = (
	food: FoodItem,
	source?: FoodFieldSource,
) =>
	Math.max(
		toTimestamp(source?.observedAt),
		toTimestamp(food.sourceModifiedDate),
		toTimestamp(food.modifiedDate),
		toTimestamp(food.sourceMetadata?.modifiedAt),
		toTimestamp(food.sourceMetadata?.updatedAt),
		toTimestamp(food.sourcePublishedDate),
		toTimestamp(food.publishedDate),
		toTimestamp(food.publicationDate),
	);

const getArrayCompleteness = (values?: unknown[]) => values?.length ?? 0;

export const getFoodFieldCompleteness = (
	food: FoodItem,
	field: FoodProvenanceField,
) => {
	switch (field) {
		case "productName":
			return Number(Boolean(food.description.trim()));
		case "brandOwner":
			return Number(Boolean(food.brandOwner?.trim()));
		case "image":
			return food.image?.imageUrl
				? 1 + Number(Boolean(food.image.thumbnailUrl))
				: 0;
		case "categories":
			return getArrayCompleteness(food.categories) +
				Number(Boolean(food.foodCategory?.trim())) +
				Number(Boolean(food.brandedFoodCategory?.trim())) +
				Number(Boolean(food.categoryOptionId)) * 10;
		case "serving":
			return getArrayCompleteness(food.foodServings) * 10 +
				Number(food.hasSourceServing === true) * 5 +
				Number(Number(food.servingSize) > 0) +
				Number(Boolean(food.householdServingFullText?.trim()));
		case "ingredients":
			return (food.ingredients?.trim().length ?? 0) +
				getArrayCompleteness(food.ingredientList) * 10;
		case "allergens":
			return getArrayCompleteness(food.allergens);
		case "traces":
			return getArrayCompleteness(food.traces);
		case "precautionaryStatements":
			return getArrayCompleteness(food.precautionaryStatements);
		case "dietaryTags":
			return getArrayCompleteness(food.dietaryTags);
		case "labels":
			return getArrayCompleteness(food.labels);
		case "structuredIngredients":
			return getArrayCompleteness(food.structuredIngredients);
		case "ingredientAnalysis":
			return food.ingredientAnalysis
				? Object.values(food.ingredientAnalysis).filter((value) =>
					Array.isArray(value) ? value.length > 0 : value !== undefined
				).length
				: 0;
		case "additives":
			return getArrayCompleteness(food.additives);
		case "package":
			return food.packageQuantity
				? Object.values(food.packageQuantity).filter(
					(value) => value !== undefined && value !== null && value !== "",
				).length
				: 0;
		case "alcoholByVolume":
			return food.alcoholByVolume &&
				Number.isFinite(food.alcoholByVolume.percent) &&
				food.alcoholByVolume.percent >= 0
				? 1
				: 0;
		case "regulatoryDisclosure":
			return food.regulatoryDisclosure?.profileKey.trim() ? 1 : 0;
		case "scientificName":
			return food.scientificName?.trim().length ?? 0;
		case "alternateDescription":
			return food.alternateDescription?.trim().length ?? 0;
		case "preparation":
			return food.preparation?.trim().length ?? 0;
		case "sourceMetadata":
			return food.sourceMetadata
				? Object.values(food.sourceMetadata).filter((value) =>
					Array.isArray(value)
						? value.length > 0
						: value !== undefined && value !== null && value !== ""
				).length
				: 0;
		case "nutrition":
			return food.foodNutrients.length;
	}
};

type FieldCandidate = {
	food: FoodItem;
	source: FoodFieldSource;
	completeness: number;
	timestamp: number;
};

const compareFieldCandidates = (
	left: FieldCandidate,
	right: FieldCandidate,
) => {
	const confidenceDifference =
			FOOD_FIELD_CONFIDENCE_RANK[right.source.confidence ?? "unknown"] -
			FOOD_FIELD_CONFIDENCE_RANK[left.source.confidence ?? "unknown"];
	if (confidenceDifference !== 0) return confidenceDifference;
	const completenessDifference = right.completeness - left.completeness;
	if (completenessDifference !== 0) return completenessDifference;
	const timestampDifference = right.timestamp - left.timestamp;
	if (timestampDifference !== 0) return timestampDifference;
	return `${left.source.source}:${left.source.sourceReference ?? ""}`.localeCompare(
		`${right.source.source}:${right.source.sourceReference ?? ""}`,
	);
};

const selectFieldCandidate = (
	foods: FoodItem[],
	field: FoodProvenanceField,
) => foods
	.flatMap((food): FieldCandidate[] => {
		const source = food.fieldProvenance?.[field];
		const completeness = getFoodFieldCompleteness(food, field);
		return source && completeness > 0
			? [{
				food,
				source,
				completeness,
				timestamp: getFoodEvidenceTimestamp(food, source),
			}]
			: [];
	})
	.sort(compareFieldCandidates)[0];

export const applySelectedFoodField = (
	result: FoodItem,
	field: FoodProvenanceField,
	selected: FoodItem,
): FoodItem => {
	switch (field) {
		case "productName":
			return {
				...result,
				description: selected.description,
				canonicalDescription: selected.canonicalDescription,
				nameProvenance: selected.nameProvenance,
			};
		case "brandOwner":
			return { ...result, brandOwner: selected.brandOwner };
		case "image":
			return { ...result, image: selected.image };
		case "categories":
			return {
				...result,
				foodCategory: selected.foodCategory,
				brandedFoodCategory: selected.brandedFoodCategory,
				categories: selected.categories,
				categoryOptionId: selected.categoryOptionId,
				symbolKey: selected.symbolKey ?? result.symbolKey,
			};
		case "serving":
			return {
				...result,
				servingSize: selected.servingSize,
				servingSizeUnit: selected.servingSizeUnit,
				householdServingFullText: selected.householdServingFullText,
				hasSourceServing: selected.hasSourceServing,
				foodServings: selected.foodServings,
			};
		case "ingredients":
			return {
				...result,
				ingredients: selected.ingredients,
				ingredientList: selected.ingredientList,
			};
		case "allergens":
			return { ...result, allergens: selected.allergens };
		case "traces":
			return { ...result, traces: selected.traces };
		case "precautionaryStatements":
			return {
				...result,
				precautionaryStatements: selected.precautionaryStatements,
			};
		case "dietaryTags":
			return { ...result, dietaryTags: selected.dietaryTags };
		case "labels":
			return { ...result, labels: selected.labels };
		case "structuredIngredients":
			return {
				...result,
				structuredIngredients: selected.structuredIngredients,
			};
		case "ingredientAnalysis":
			return {
				...result,
				ingredientAnalysis: selected.ingredientAnalysis,
			};
		case "additives":
			return { ...result, additives: selected.additives };
		case "package":
			return {
				...result,
				packageQuantity: selected.packageQuantity,
				packageWeight: selected.packageWeight,
			};
		case "alcoholByVolume":
			return { ...result, alcoholByVolume: selected.alcoholByVolume };
		case "regulatoryDisclosure":
			return { ...result, regulatoryDisclosure: selected.regulatoryDisclosure };
		case "scientificName":
			return { ...result, scientificName: selected.scientificName };
		case "alternateDescription":
			return {
				...result,
				alternateDescription: selected.alternateDescription,
			};
		case "preparation":
			return { ...result, preparation: selected.preparation };
		case "sourceMetadata":
			return {
				...result,
				sourceMetadata: selected.sourceMetadata,
				sourcePublishedDate: selected.sourcePublishedDate,
				sourceModifiedDate: selected.sourceModifiedDate,
				publishedDate: selected.publishedDate,
				publicationDate: selected.publicationDate,
				modifiedDate: selected.modifiedDate,
				availableDate: selected.availableDate,
				discontinuedDate: selected.discontinuedDate,
			};
		case "nutrition":
			return result;
	}
};

const isUsableNutrient = (nutrient: FoodNutrient) =>
	Number.isSafeInteger(nutrient.nutrientId) &&
	nutrient.nutrientId > 0 &&
	Number.isFinite(nutrient.value) &&
	nutrient.value >= 0;

const getNutrientEvidenceRank = (nutrient: FoodNutrient) => {
	if (nutrient.valueOrigin === "reported") return 3;
	if (nutrient.valueOrigin === "derived") return 2;
	if (nutrient.valueOrigin === "estimated") return 1;
	return 0;
};

type NutrientCandidate = {
	food: FoodItem;
	nutrient: FoodNutrient;
	source: FoodFieldSource;
	timestamp: number;
};

const isNutrientDataSource = (
	source: FoodFieldSource["source"],
): source is NonNullable<FoodNutrient["source"]> =>
	source !== "shared-catalog" && source !== "wikimedia-commons";

const compareNutrientCandidates = (
	left: NutrientCandidate,
	right: NutrientCandidate,
) => {
	const confidenceDifference =
			FOOD_FIELD_CONFIDENCE_RANK[right.source.confidence ?? "unknown"] -
			FOOD_FIELD_CONFIDENCE_RANK[left.source.confidence ?? "unknown"];
	if (confidenceDifference !== 0) return confidenceDifference;
	const evidenceDifference =
		getNutrientEvidenceRank(right.nutrient) -
		getNutrientEvidenceRank(left.nutrient);
	if (evidenceDifference !== 0) return evidenceDifference;
	const reviewedMappingDifference =
		Number(Boolean(right.nutrient.mappingReviewReference)) -
		Number(Boolean(left.nutrient.mappingReviewReference));
	if (reviewedMappingDifference !== 0) return reviewedMappingDifference;
	const timestampDifference = right.timestamp - left.timestamp;
	if (timestampDifference !== 0) return timestampDifference;
	return `${left.source.source}:${left.source.sourceReference ?? ""}`.localeCompare(
		`${right.source.source}:${right.source.sourceReference ?? ""}`,
	);
};

const resolveNutrients = (foods: FoodItem[], baseFood: FoodItem) => {
	const candidatesByNutrientId = new Map<number, NutrientCandidate[]>();
	for (const food of foods) {
		for (const nutrient of food.foodNutrients.filter(isUsableNutrient)) {
			const fieldSource = food.fieldProvenance?.nutrition;
			const matchingFieldSource =
				nutrient.source && fieldSource?.source === nutrient.source
					? fieldSource
					: undefined;
			const source = nutrient.source
				? {
					source: nutrient.source,
					sourceReference:
						nutrient.sourceReference ?? matchingFieldSource?.sourceReference,
					confidence:
						nutrient.confidence ?? matchingFieldSource?.confidence ?? "unknown" as const,
				}
				: fieldSource && isNutrientDataSource(fieldSource.source)
					? fieldSource
					: undefined;
			if (!source) continue;
			const candidates = candidatesByNutrientId.get(nutrient.nutrientId) ?? [];
			candidates.push({
				food,
				nutrient,
				source,
				timestamp: getFoodEvidenceTimestamp(food, source),
			});
			candidatesByNutrientId.set(nutrient.nutrientId, candidates);
		}
	}

	const selected = [...candidatesByNutrientId.values()]
		.map((candidates) => candidates.sort(compareNutrientCandidates)[0])
		.filter((candidate): candidate is NutrientCandidate => Boolean(candidate))
		.sort((left, right) => left.nutrient.nutrientId - right.nutrient.nutrientId);
	const nutrientSources = new Map(
		selected.map(({ source }) => [
			`${source.source}:${source.sourceReference ?? ""}:${source.confidence ?? "unknown"}`,
			source,
		]),
	);
	const selectedNutrientIds = new Set(
		selected.map(({ nutrient }) => nutrient.nutrientId),
	);
	const unresolvedBaseNutrients = baseFood.foodNutrients
		.filter(isUsableNutrient)
		.filter((nutrient) => !selectedNutrientIds.has(nutrient.nutrientId));
	const resolvedNutrients = [
		...selected.map(({ nutrient, source }) => ({
			...nutrient,
			source: isNutrientDataSource(source.source)
				? source.source
				: nutrient.source,
			sourceReference: source.sourceReference,
			confidence: source.confidence ?? "unknown",
		})),
		...unresolvedBaseNutrients,
	].sort((left, right) => left.nutrientId - right.nutrientId);

	const reportedNutrientIds = [
		...new Set([
			...selected
				.filter(({ food, nutrient }) =>
					nutrient.valueOrigin === "reported" ||
					food.reportedNutrientIds?.includes(nutrient.nutrientId)
				)
				.map(({ nutrient }) => nutrient.nutrientId),
			...(baseFood.reportedNutrientIds ?? []).filter((nutrientId) =>
				unresolvedBaseNutrients.some(
					(nutrient) => nutrient.nutrientId === nutrientId,
				)
			),
		]),
	].sort((left, right) => left - right);

	return {
		foodNutrients: resolvedNutrients,
		reportedNutrientIds:
			reportedNutrientIds.length > 0 ||
			foods.some((food) => food.reportedNutrientIds !== undefined)
				? reportedNutrientIds
				: undefined,
		fieldSource: nutrientSources.size === 1 && unresolvedBaseNutrients.length === 0
			? nutrientSources.values().next().value as FoodFieldSource
			: undefined,
	};
};

const getAttributionKey = (attribution: FoodSourceAttribution) =>
	`${attribution.datasetKey}:${attribution.datasetVersion}:${attribution.sourceUrl}`;

export const getFoodSourceAttributions = (food: FoodItem) => {
	const attributions = [
		...(food.sourceAttributions ?? []),
		...(food.sourceAttribution ? [food.sourceAttribution] : []),
	];
	return [...new Map(
		attributions.map((attribution) => [getAttributionKey(attribution), attribution]),
	).values()];
};

const selectBaseFood = (foods: FoodItem[]) => [...foods].sort((left, right) => {
	const attributionDifference =
		getFoodSourceAttributions(right).length - getFoodSourceAttributions(left).length;
	if (attributionDifference !== 0) return attributionDifference;
	const referenceDifference =
		Object.keys(right.sourceIdentifiers ?? {}).length -
		Object.keys(left.sourceIdentifiers ?? {}).length;
	if (referenceDifference !== 0) return referenceDifference;
	return `${left.sourceKey ?? ""}:${left.fdcId}`.localeCompare(
		`${right.sourceKey ?? ""}:${right.fdcId}`,
	);
})[0];

export const resolveExactIdentityFoodFields = (foods: FoodItem[]): FoodItem => {
	const base = selectBaseFood(foods) ?? foods[0];
	const sourceIdentifiers: Record<string, string> = {
		...(base.sourceIdentifiers ?? {}),
	};
	for (const food of [...foods].sort((left, right) =>
		`${left.sourceKey ?? ""}:${left.fdcId}`.localeCompare(
			`${right.sourceKey ?? ""}:${right.fdcId}`,
		)
	)) {
		for (const [key, value] of Object.entries(food.sourceIdentifiers ?? {})) {
			if (sourceIdentifiers[key] === undefined) sourceIdentifiers[key] = value;
		}
	}
	const sourceAttributions = [
		...new Map(
			foods.flatMap(getFoodSourceAttributions).map((attribution) => [
				getAttributionKey(attribution),
				attribution,
			]),
		).values(),
	].sort((left, right) =>
		`${left.datasetName}:${left.datasetVersion}:${left.sourceUrl}`.localeCompare(
			`${right.datasetName}:${right.datasetVersion}:${right.sourceUrl}`,
		)
	);
	const nutrientSourceReview = [
		...new Map(
			foods
				.flatMap((food) => food.nutrientSourceReview ?? [])
				.map((review) => [
					[
						review.source ?? "unknown",
						review.sourceReference ?? "",
						review.sourceNutrientKey ?? "",
						review.nutrientId ?? "",
						review.unitName ?? "",
					].join(":"),
					review,
				]),
		).values(),
	];
	let result: FoodItem = {
		...base,
		...(Object.keys(sourceIdentifiers).length > 0 ? { sourceIdentifiers } : {}),
		...(sourceAttributions.length > 0 ? { sourceAttributions } : {}),
		...(nutrientSourceReview.length > 0 ? { nutrientSourceReview } : {}),
	};
	const fieldProvenance: FoodFieldProvenance = {
		...base.fieldProvenance,
	};

	for (const field of EXACT_IDENTITY_RESOLVABLE_FIELDS) {
		const candidate = selectFieldCandidate(foods, field);
		if (!candidate) continue;
		result = applySelectedFoodField(result, field, candidate.food);
		fieldProvenance[field] = candidate.source;
	}

	const nutrition = resolveNutrients(foods, base);
	if (nutrition.foodNutrients.length > 0) {
		result.foodNutrients = nutrition.foodNutrients;
		if (nutrition.reportedNutrientIds !== undefined) {
			result.reportedNutrientIds = nutrition.reportedNutrientIds;
		} else {
			delete result.reportedNutrientIds;
		}
		if (nutrition.fieldSource) {
			fieldProvenance.nutrition = nutrition.fieldSource;
		} else {
			delete fieldProvenance.nutrition;
		}
	}

	return {
		...result,
		...(Object.keys(fieldProvenance).length > 0 ? { fieldProvenance } : {}),
		...(result.sourceAttribution || sourceAttributions[0]
			? {
					sourceAttribution:
						result.sourceAttribution ?? sourceAttributions[0],
				}
			: {}),
	};
};
