import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type {
	FoodNutrient,
	FoodNutrientMeasurementBasis,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodTrackedField,
} from "$lib/utils/food/types";
import { validateNutrientRelationshipRules } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { getNutrientAmountForServingConversion } from "$lib/utils/food/nutrients/foodNutrients";
import {
	convertFoodServingMultiplier,
	convertServingAmount,
	type ServingConversion,
} from "$lib/utils/serving/servingAmount";
import {
	getProductResolutionRank,
	getProductResolutionScoringWeight,
	type ProductResolutionPolicy,
} from "$lib/utils/products/productResolutionPolicy";

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
	"alcoholByVolume",
	"regulatoryDisclosure",
	"sourceMetadata",
];

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

const getArrayScore = (values: unknown[] | undefined, weight: number) =>
	(values?.length ?? 0) * weight;

const getFieldCompleteness = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
	policy: ProductResolutionPolicy,
) => {
	const weight = (metricKey: string) =>
		getProductResolutionScoringWeight(policy, `field:${field}`, metricKey);
	switch (field) {
		case "productName":
			return draft.name.trim().length * weight("text-character");
		case "brandOwner":
			return draft.brandOwner.trim().length * weight("text-character");
		case "image":
			return draft.image?.imageUrl
				? weight("primary-image") +
						Number(Boolean(draft.image.thumbnailUrl)) *
							weight("thumbnail-image")
				: 0;
		case "categories":
			return (
				getArrayScore(draft.categories, weight("source-item")) +
				Number(Boolean(draft.categoryResolution)) *
					weight("canonical-resolution") +
				Number(Boolean(draft.resolvedCategory)) * weight("canonical-value")
			);
		case "serving":
			return (
				Number(draft.hasSourceServing === true) * weight("source-serving") +
				Number(Number(draft.servingWeightGrams) > 0) *
					weight("positive-weight") +
				Number(Boolean(draft.servingLabel.trim())) * weight("display-label") +
				Number(Boolean(draft.volumeEquivalent)) * weight("volume-equivalent") +
				Number(
					Boolean(draft.serving?.origin && draft.serving.origin !== "unknown"),
				) *
					weight("known-origin")
			);
		case "ingredients":
			return (
				(draft.ingredients?.trim().length ?? 0) * weight("text-character") +
				getArrayScore(draft.ingredientList, weight("structured-item"))
			);
		case "allergens":
			return getArrayScore(draft.allergens, weight("source-item"));
		case "traces":
			return getArrayScore(draft.traces, weight("source-item"));
		case "precautionaryStatements":
			return getArrayScore(
				draft.precautionaryStatements,
				weight("source-item"),
			);
		case "dietaryTags":
			return getArrayScore(draft.dietaryTags, weight("source-item"));
		case "labels":
			return getArrayScore(draft.labels, weight("source-item"));
		case "structuredIngredients":
			return getArrayScore(draft.structuredIngredients, weight("source-item"));
		case "ingredientAnalysis":
			return draft.ingredientAnalysis
				? Object.values(draft.ingredientAnalysis).filter((value) =>
						Array.isArray(value) ? value.length > 0 : value !== undefined,
					).length * weight("populated-property")
				: 0;
		case "additives":
			return getArrayScore(draft.additives, weight("source-item"));
		case "package":
			return draft.packageQuantity
				? Object.values(draft.packageQuantity).filter(
						(value) => value !== undefined && value !== null && value !== "",
					).length * weight("populated-property")
				: 0;
		case "alcoholByVolume":
			return draft.alcoholByVolume &&
				Number.isFinite(draft.alcoholByVolume.percent) &&
				draft.alcoholByVolume.percent >= 0
				? weight("reported-value")
				: 0;
		case "regulatoryDisclosure":
			return draft.regulatoryDisclosure?.profileKey.trim()
				? weight("profile-key")
				: 0;
		case "sourceMetadata":
			return draft.sourceMetadata
				? Object.values(draft.sourceMetadata).filter((value) =>
						Array.isArray(value)
							? value.length > 0
							: value !== undefined && value !== null && value !== "",
					).length * weight("populated-property")
				: 0;
		case "nutrition":
			return getArrayScore(
				draft.nutrients.filter(isValidNutrient),
				weight("source-item"),
			);
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
	policy: ProductResolutionPolicy,
) => getFieldCompleteness(draft, field, policy) > 0;

type FieldCandidate = {
	draft: BarcodeProductDraft;
	source: FoodFieldSource;
	completeness: number;
	timestamp: number;
};

const compareCandidates = (
	left: FieldCandidate,
	right: FieldCandidate,
	policy: ProductResolutionPolicy,
) => {
	const confidenceDifference =
		getProductResolutionRank(
			policy,
			"field-confidence",
			right.source.confidence ?? "unknown",
		) -
		getProductResolutionRank(
			policy,
			"field-confidence",
			left.source.confidence ?? "unknown",
		);
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
	policy: ProductResolutionPolicy,
) =>
	drafts
		.flatMap((draft): FieldCandidate[] => {
			const source = draft.fieldProvenance?.[field];
			return source && hasFieldValue(draft, field, policy)
				? [
						{
							draft,
							source,
							completeness: getFieldCompleteness(draft, field, policy),
							timestamp: getDraftTimestamp(draft),
						},
					]
				: [];
		})
		.sort((left, right) => compareCandidates(left, right, policy))[0];

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
		case "alcoholByVolume":
			return { ...result, alcoholByVolume: selected.alcoholByVolume };
		case "regulatoryDisclosure":
			return { ...result, regulatoryDisclosure: selected.regulatoryDisclosure };
		case "sourceMetadata":
			return { ...result, sourceMetadata: selected.sourceMetadata };
		case "nutrition":
			return result;
	}
};

const getDraftNutrientTarget = (
	draft: BarcodeProductDraft,
): {
	conversion: ServingConversion;
	basis: FoodNutrientMeasurementBasis;
} => {
	if (draft.hasSourceServing && draft.serving) {
		return {
			conversion: convertFoodServingMultiplier(draft.serving, 1),
			basis: {
				kind: "serving",
				quantity: 1,
				unitKey: "serving",
				servingLabel: draft.serving.label,
			},
		};
	}
	return {
		conversion: convertServingAmount(100, "g"),
		basis: { kind: "mass", quantity: 100, unitKey: "g" },
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

type ResolvedNutrientCandidate = NutrientCandidate & {
	resolvedValue: number;
};

const isNutrientSource = (
	source: FoodFieldSource["source"],
): source is NonNullable<FoodNutrient["source"]> =>
	source !== "wikimedia-commons" && source !== "shared-catalog";

const compareNutrientCandidates = (
	left: NutrientCandidate,
	right: NutrientCandidate,
	policy: ProductResolutionPolicy,
) => {
	const confidenceDifference =
		getProductResolutionRank(
			policy,
			"field-confidence",
			right.source.confidence ?? "unknown",
		) -
		getProductResolutionRank(
			policy,
			"field-confidence",
			left.source.confidence ?? "unknown",
		);
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

const removeNutrientsThatViolateRelationships = (
	nutrients: FoodNutrient[],
	policy: ProductResolutionPolicy,
) => {
	let remainingNutrients = nutrients;

	while (remainingNutrients.length > 0) {
		const issues = validateNutrientRelationshipRules(
			new Map(
				remainingNutrients.map((nutrient) => [
					nutrient.nutrientId,
					nutrient.value,
				]),
			),
			[...policy.nutrientRelationshipRules],
		);
		if (issues.length === 0) break;

		const invalidChildNutrientIds = new Set(
			issues.map((issue) => issue.childNutrientId),
		);
		const nextNutrients = remainingNutrients.filter(
			(nutrient) => !invalidChildNutrientIds.has(nutrient.nutrientId),
		);
		if (nextNutrients.length === remainingNutrients.length) break;
		remainingNutrients = nextNutrients;
	}

	return remainingNutrients;
};

const resolveNutrients = (
	drafts: BarcodeProductDraft[],
	targetDraft: BarcodeProductDraft,
	policy: ProductResolutionPolicy,
) => {
	const target = getDraftNutrientTarget(targetDraft);
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
		.map((candidates) =>
			candidates
				.sort((left, right) => compareNutrientCandidates(left, right, policy))
				.map((candidate) => ({
					...candidate,
					resolvedValue: getNutrientAmountForServingConversion(
						candidate.nutrient,
						target.conversion,
					),
				}))
				.find((candidate) => candidate.resolvedValue !== null),
		)
		.filter(
			(candidate): candidate is ResolvedNutrientCandidate =>
				candidate?.resolvedValue !== null && candidate !== undefined,
		)
		.sort(
			(left, right) => left.nutrient.nutrientId - right.nutrient.nutrientId,
		);
	let nutrients: FoodNutrient[] = selected.map(
		({ nutrient, source, resolvedValue }) => ({
			...nutrient,
			value: Number(resolvedValue),
			measurementBasis: target.basis,
			source: source.source,
			sourceReference: source.sourceReference,
			confidence: source.confidence ?? "unknown",
		}),
	);
	let reportedNutrientIds = selected
		.filter(({ draft, nutrient }) =>
			draft.reportedNutrientIds.includes(nutrient.nutrientId),
		)
		.map(({ nutrient }) => nutrient.nutrientId);
	const resolvedValues = new Map(
		nutrients.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
	);
	if (
		validateNutrientRelationshipRules(resolvedValues, [
			...policy.nutrientRelationshipRules,
		]).length > 0
	) {
		const coherentDrafts = drafts.filter((draft) => {
			const values = new Map(
				draft.nutrients
					.filter(isValidNutrient)
					.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
			);
			return (
				values.size > 0 &&
				validateNutrientRelationshipRules(values, [
					...policy.nutrientRelationshipRules,
				]).length === 0
			);
		});
		const coherentCandidate = selectFieldCandidate(
			coherentDrafts,
			"nutrition",
			policy,
		);
		if (coherentCandidate) {
			const coherentSource = coherentCandidate.source;
			nutrients = coherentCandidate.draft.nutrients
				.filter(isValidNutrient)
				.map((nutrient) => ({
					nutrient,
					resolvedValue: getNutrientAmountForServingConversion(
						nutrient,
						target.conversion,
					),
				}))
				.filter(
					(
						candidate,
					): candidate is {
						nutrient: FoodNutrient;
						resolvedValue: number;
					} => candidate.resolvedValue !== null,
				)
				.map(({ nutrient, resolvedValue }) => ({
					...nutrient,
					value: resolvedValue,
					measurementBasis: target.basis,
					source: isNutrientSource(coherentSource.source)
						? coherentSource.source
						: nutrient.source,
					sourceReference:
						coherentSource.sourceReference ?? nutrient.sourceReference,
					confidence: coherentSource.confidence ?? nutrient.confidence,
				}));
			reportedNutrientIds = coherentCandidate.draft.reportedNutrientIds.filter(
				(nutrientId) =>
					nutrients.some((nutrient) => nutrient.nutrientId === nutrientId),
			);
		}
	}

	nutrients = removeNutrientsThatViolateRelationships(nutrients, policy);
	reportedNutrientIds = reportedNutrientIds.filter((nutrientId) =>
		nutrients.some((nutrient) => nutrient.nutrientId === nutrientId),
	);
	const nutrientSources: Map<string, FoodFieldSource> = new Map(
		nutrients.flatMap((nutrient) =>
			nutrient.source && isNutrientSource(nutrient.source)
				? [
						[
							`${nutrient.source}:${nutrient.sourceReference ?? ""}:${nutrient.confidence ?? "unknown"}`,
							{
								source: nutrient.source,
								sourceReference: nutrient.sourceReference,
								confidence: nutrient.confidence ?? "unknown",
							} satisfies FoodFieldSource,
						] as const,
					]
				: [],
		),
	);

	return {
		nutrients,
		reportedNutrientIds,
		fieldSource:
			nutrientSources.size === 1
				? (nutrientSources.values().next().value as FoodFieldSource)
				: undefined,
	};
};

const getDraftCompleteness = (
	draft: BarcodeProductDraft,
	policy: ProductResolutionPolicy,
) =>
	TRACKED_FIELDS.reduce(
		(total, field) => total + getFieldCompleteness(draft, field, policy),
		Number(Boolean(draft.name.trim())) +
			Number(Boolean(draft.brandOwner.trim())),
	);

const selectBaseDraft = (
	drafts: BarcodeProductDraft[],
	policy: ProductResolutionPolicy,
) =>
	[...drafts].sort((left, right) => {
		const completenessDifference =
			getDraftCompleteness(right, policy) - getDraftCompleteness(left, policy);
		if (completenessDifference !== 0) return completenessDifference;
		const timestampDifference =
			getDraftTimestamp(right) - getDraftTimestamp(left);
		if (timestampDifference !== 0) return timestampDifference;
		return `${left.source}:${left.sourceReference ?? ""}`.localeCompare(
			`${right.source}:${right.sourceReference ?? ""}`,
		);
	})[0];

export const resolveBarcodeProductFields = (
	inputDrafts: Array<BarcodeProductDraft | null | undefined>,
	policy: ProductResolutionPolicy,
): BarcodeProductDraft | null => {
	const firstDraft = inputDrafts.find((draft): draft is BarcodeProductDraft =>
		Boolean(draft),
	);
	if (!firstDraft) return null;
	const drafts = inputDrafts.filter((draft): draft is BarcodeProductDraft =>
		Boolean(draft && draft.barcode === firstDraft.barcode),
	);
	const base = selectBaseDraft(drafts, policy);
	if (!base) return null;

	let result: BarcodeProductDraft = {
		...base,
		fieldProvenance: { ...base.fieldProvenance },
	};
	const fieldProvenance: FoodFieldProvenance = {};
	for (const field of TRACKED_FIELDS) {
		const candidate = selectFieldCandidate(drafts, field, policy);
		if (!candidate) continue;
		result = applySelectedField(result, field, candidate.draft);
		fieldProvenance[field] = candidate.source;
	}

	const resolvedNutrients = resolveNutrients(drafts, result, policy);
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
