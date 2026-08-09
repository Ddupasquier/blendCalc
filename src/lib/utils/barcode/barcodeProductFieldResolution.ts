import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type {
	FoodNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodTrackedField,
} from "$lib/utils/food/types";

export const BARCODE_PRODUCT_FIELD_RESOLUTION_POLICY_VERSION = 1;

const TRACKED_FIELDS: FoodTrackedField[] = [
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
	"sourceMetadata",
];

const CONFIDENCE_RANK: Record<
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
	if (!value) return 0;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : 0;
};

const getDraftTimestamp = (draft: BarcodeProductDraft) =>
	Math.max(
		toTimestamp(draft.sourceModifiedDate),
		toTimestamp(draft.sourcePublishedDate),
	);

const getArrayScore = (values?: unknown[]) => values?.length ?? 0;

const getFieldCompleteness = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
) => {
	switch (field) {
		case "productName":
			return draft.name.trim().length;
		case "brandOwner":
			return draft.brandOwner.trim().length;
		case "image":
			return draft.image?.imageUrl
				? 1 + Number(Boolean(draft.image.thumbnailUrl))
				: 0;
		case "categories":
			return getArrayScore(draft.categories) +
				(draft.categoryResolution ? 10 : 0) +
				Number(Boolean(draft.resolvedCategory));
			case "serving":
				return Number(draft.hasSourceServing === true) * 10 +
					Number(draft.servingWeightGrams > 0) +
					Number(Boolean(draft.servingLabel.trim())) +
					Number(Boolean(draft.volumeEquivalent)) +
					Number(Boolean(draft.serving?.origin && draft.serving.origin !== "unknown"));
		case "ingredients":
			return (draft.ingredients?.trim().length ?? 0) +
				getArrayScore(draft.ingredientList) * 10;
		case "allergens":
			return getArrayScore(draft.allergens);
		case "traces":
			return getArrayScore(draft.traces);
		case "precautionaryStatements":
			return getArrayScore(draft.precautionaryStatements);
		case "dietaryTags":
			return getArrayScore(draft.dietaryTags);
		case "labels":
			return getArrayScore(draft.labels);
		case "structuredIngredients":
			return getArrayScore(draft.structuredIngredients);
		case "ingredientAnalysis":
			return draft.ingredientAnalysis
				? Object.values(draft.ingredientAnalysis).filter((value) =>
					Array.isArray(value) ? value.length > 0 : value !== undefined
				).length
				: 0;
		case "additives":
			return getArrayScore(draft.additives);
		case "package":
			return draft.packageQuantity
				? Object.values(draft.packageQuantity).filter(
					(value) => value !== undefined && value !== null && value !== "",
				).length
				: 0;
		case "sourceMetadata":
			return draft.sourceMetadata
				? Object.values(draft.sourceMetadata).filter((value) =>
					Array.isArray(value)
						? value.length > 0
						: value !== undefined && value !== null && value !== ""
				).length
				: 0;
		case "nutrition":
			return draft.nutrients.filter(isValidNutrient).length;
	}
};

const isValidNutrient = (nutrient: FoodNutrient) =>
	Number.isSafeInteger(nutrient.nutrientId) &&
	nutrient.nutrientId > 0 &&
	Number.isFinite(nutrient.value) &&
	nutrient.value >= 0;

const hasFieldValue = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
) => getFieldCompleteness(draft, field) > 0;

type FieldCandidate = {
	draft: BarcodeProductDraft;
	source: FoodFieldSource;
	completeness: number;
	timestamp: number;
};

const compareCandidates = (left: FieldCandidate, right: FieldCandidate) => {
	const confidenceDifference =
		CONFIDENCE_RANK[right.source.confidence ?? "unknown"] -
		CONFIDENCE_RANK[left.source.confidence ?? "unknown"];
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
	drafts: BarcodeProductDraft[],
	field: FoodTrackedField,
) =>
	drafts
		.flatMap((draft): FieldCandidate[] => {
			const source = draft.fieldProvenance?.[field];
			return source && hasFieldValue(draft, field)
				? [{
					draft,
					source,
					completeness: getFieldCompleteness(draft, field),
					timestamp: getDraftTimestamp(draft),
				}]
				: [];
		})
		.sort(compareCandidates)[0];

const applySelectedField = (
	result: BarcodeProductDraft,
	field: FoodTrackedField,
	selected: BarcodeProductDraft,
): BarcodeProductDraft => {
	switch (field) {
		case "productName":
			return {
				...result,
				name: selected.name,
				nameProvenance: selected.nameProvenance,
			};
		case "brandOwner":
			return { ...result, brandOwner: selected.brandOwner };
		case "image":
			return { ...result, image: selected.image };
		case "categories":
			return {
				...result,
				categories: selected.categories,
				resolvedCategory: selected.resolvedCategory,
				categoryResolution: selected.categoryResolution,
			};
		case "serving":
			return {
				...result,
				servingLabel: selected.servingLabel,
					servingWeightGrams: selected.servingWeightGrams,
					hasSourceServing: selected.hasSourceServing,
					serving: selected.serving,
					volumeEquivalent: selected.volumeEquivalent,
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
			return { ...result, packageQuantity: selected.packageQuantity };
		case "sourceMetadata":
			return { ...result, sourceMetadata: selected.sourceMetadata };
		case "nutrition":
			return result;
	}
};

const scaleNutrient = (
	nutrient: FoodNutrient,
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
		return { ...nutrient };
	}
	return {
		...nutrient,
		value: nutrient.value * (toGrams / fromGrams),
	};
};

type NutrientCandidate = {
	draft: BarcodeProductDraft;
	nutrient: FoodNutrient;
	source: FoodFieldSource & {
		source: NonNullable<FoodNutrient["source"]>;
	};
	timestamp: number;
};

const isNutrientSource = (
	source: FoodFieldSource["source"],
): source is NonNullable<FoodNutrient["source"]> =>
	source !== "wikimedia-commons" && source !== "shared-catalog";

const compareNutrientCandidates = (
	left: NutrientCandidate,
	right: NutrientCandidate,
) => {
	const confidenceDifference =
		CONFIDENCE_RANK[right.source.confidence ?? "unknown"] -
		CONFIDENCE_RANK[left.source.confidence ?? "unknown"];
	if (confidenceDifference !== 0) return confidenceDifference;

	const reportedDifference =
		Number(right.nutrient.valueOrigin === "reported") -
		Number(left.nutrient.valueOrigin === "reported");
	if (reportedDifference !== 0) return reportedDifference;

	const timestampDifference = right.timestamp - left.timestamp;
	if (timestampDifference !== 0) return timestampDifference;

	return `${left.source.source}:${left.source.sourceReference ?? ""}`.localeCompare(
		`${right.source.source}:${right.source.sourceReference ?? ""}`,
	);
};

const resolveNutrients = (
	drafts: BarcodeProductDraft[],
	servingWeightGrams: number,
) => {
	const candidatesById = new Map<number, NutrientCandidate[]>();
	for (const draft of drafts) {
		for (const nutrient of draft.nutrients.filter(isValidNutrient)) {
			const fieldSource = draft.fieldProvenance?.nutrition;
			const source = nutrient.source
				? {
					source: nutrient.source,
					sourceReference: nutrient.sourceReference,
					confidence: nutrient.confidence ?? "unknown",
				}
				: fieldSource && isNutrientSource(fieldSource.source)
					? { ...fieldSource, source: fieldSource.source }
					: undefined;
			if (!source) continue;
			const candidates = candidatesById.get(nutrient.nutrientId) ?? [];
			candidates.push({
				draft,
				nutrient,
				source,
				timestamp: getDraftTimestamp(draft),
			});
			candidatesById.set(nutrient.nutrientId, candidates);
		}
	}

	const selected = [...candidatesById.values()]
		.map((candidates) => candidates.sort(compareNutrientCandidates)[0])
		.filter((candidate): candidate is NutrientCandidate => Boolean(candidate))
		.sort((left, right) =>
			left.nutrient.nutrientId - right.nutrient.nutrientId
		);
	const nutrients = selected.map(({ draft, nutrient, source }) => ({
		...scaleNutrient(
			nutrient,
			draft.servingWeightGrams,
			servingWeightGrams,
		),
		source: source.source,
		sourceReference: source.sourceReference,
		confidence: source.confidence ?? "unknown",
	}));
	const reportedNutrientIds = selected
		.filter(({ draft, nutrient }) =>
			draft.reportedNutrientIds.includes(nutrient.nutrientId)
		)
		.map(({ nutrient }) => nutrient.nutrientId);
	const nutrientSources = new Map(
		selected.map(({ source }) => [
			`${source.source}:${source.sourceReference ?? ""}:${source.confidence ?? "unknown"}`,
			source,
		]),
	);

	return {
		nutrients,
		reportedNutrientIds,
		fieldSource:
			nutrientSources.size === 1
				? nutrientSources.values().next().value as FoodFieldSource
				: undefined,
	};
};

const getDraftCompleteness = (draft: BarcodeProductDraft) =>
	TRACKED_FIELDS.reduce(
		(total, field) => total + Number(hasFieldValue(draft, field)),
		Number(Boolean(draft.name.trim())) + Number(Boolean(draft.brandOwner.trim())),
	);

const selectBaseDraft = (drafts: BarcodeProductDraft[]) =>
	[...drafts].sort((left, right) => {
		const completenessDifference =
			getDraftCompleteness(right) - getDraftCompleteness(left);
		if (completenessDifference !== 0) return completenessDifference;
		const timestampDifference = getDraftTimestamp(right) - getDraftTimestamp(left);
		if (timestampDifference !== 0) return timestampDifference;
		return `${left.source}:${left.sourceReference ?? ""}`.localeCompare(
			`${right.source}:${right.sourceReference ?? ""}`,
		);
	})[0];

export const resolveBarcodeProductFields = (
	inputDrafts: Array<BarcodeProductDraft | null | undefined>,
): BarcodeProductDraft | null => {
	const firstDraft = inputDrafts.find(
		(draft): draft is BarcodeProductDraft => Boolean(draft),
	);
	if (!firstDraft) return null;
	const drafts = inputDrafts.filter(
		(draft): draft is BarcodeProductDraft =>
			Boolean(draft && draft.barcode === firstDraft.barcode),
	);
	const base = selectBaseDraft(drafts);
	if (!base) return null;

	let result: BarcodeProductDraft = {
		...base,
		fieldProvenance: { ...base.fieldProvenance },
	};
	let fieldProvenance: FoodFieldProvenance = {};
	for (const field of TRACKED_FIELDS) {
		const candidate = selectFieldCandidate(drafts, field);
		if (!candidate) continue;
		result = applySelectedField(result, field, candidate.draft);
		fieldProvenance[field] = candidate.source;
	}

	const resolvedNutrients = resolveNutrients(
		drafts,
		result.servingWeightGrams,
	);
	if (resolvedNutrients.nutrients.length > 0) {
		result = {
			...result,
			nutrients: resolvedNutrients.nutrients,
			reportedNutrientIds: resolvedNutrients.reportedNutrientIds,
		};
		if (resolvedNutrients.fieldSource) {
			fieldProvenance.nutrition = resolvedNutrients.fieldSource;
		}
	}

	return {
		...result,
		fieldProvenance,
	};
};
