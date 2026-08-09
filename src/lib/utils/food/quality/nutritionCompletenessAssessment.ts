import { resolveFoodNutrient, type NutrientResolutionMethod } from "$lib/utils/food/nutrients/foodNutrients";
import type { FoodItem } from "$lib/utils/food/types";
import {
	getNutritionCompletenessProfile,
	type NutritionCompletenessCatalog,
	type NutritionRequirementLevel,
} from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export type NutrientCompletenessDetail = {
	nutrientId: number;
	label: string;
	source: NutrientResolutionMethod;
	sourceLabel: string;
	detail: string;
	requirementLevel: NutritionRequirementLevel;
};

export type NutritionCompletenessAssessment = {
	status: "complete" | "resolved" | "partial" | "limited" | "unavailable";
	label: string;
	title: string;
	score: number;
	completeCount: number;
	missingCount: number;
	recommendedMissingCount: number;
	profileKey: string | null;
	profileName: string | null;
	sourceCounts: Record<NutrientResolutionMethod, number>;
	details: NutrientCompletenessDetail[];
	needsDetails: boolean;
};

const createSourceCounts = (): Record<NutrientResolutionMethod, number> => ({
	exact: 0,
	mapped: 0,
	derived: 0,
	missing: 0,
});

const sourceScores: Record<NutrientResolutionMethod, number> = {
	exact: 3,
	mapped: 2,
	derived: 1,
	missing: 0,
};

export const assessNutritionCompleteness = (
	food: FoodItem,
	catalog?: NutritionCompletenessCatalog,
): NutritionCompletenessAssessment => {
	const profile = getNutritionCompletenessProfile(food, catalog);
	if (!profile) {
		return {
			status: "unavailable",
			label: "Unavailable",
			title: "Nutrition completeness rules are temporarily unavailable.",
			score: 0,
			completeCount: 0,
			missingCount: 0,
			recommendedMissingCount: 0,
			profileKey: null,
			profileName: null,
			sourceCounts: createSourceCounts(),
			details: [],
			needsDetails: false,
		};
	}

	const sourceCounts = createSourceCounts();

	const details = profile.nutrients.map((nutrient) => {
		const resolved = resolveFoodNutrient(food, nutrient.nutrientId);
		const detail = getNutrientCompletenessDetail(
			nutrient.nutrientId,
			nutrient.label,
			resolved.source,
			nutrient.requirementLevel,
		);
		return detail;
	});

	for (const detail of details) {
		const source = detail.source;
		sourceCounts[source] += 1;
	}

	const requiredDetails = details.filter(
		(detail) => detail.requirementLevel === "required",
	);
	const recommendedDetails = details.filter(
		(detail) => detail.requirementLevel === "recommended",
	);
	const missingCount = requiredDetails.filter(
		(detail) => detail.source === "missing",
	).length;
	const recommendedMissingCount = recommendedDetails.filter(
		(detail) => detail.source === "missing",
	).length;
	const completeCount = requiredDetails.length - missingCount;
	const weightedMaximum = details.reduce(
		(total, detail) =>
			total + (detail.requirementLevel === "required" ? 4 : 1) * 3,
		0,
	);
	const weightedScore = details.reduce(
		(total, detail) =>
			total +
			(detail.requirementLevel === "required" ? 4 : 1) *
				sourceScores[detail.source],
		0,
	);
	const score = weightedMaximum > 0
		? Math.round((weightedScore / weightedMaximum) * 100)
		: 0;
	const requiredMappedCount = requiredDetails.filter(
		(detail) => detail.source === "mapped" || detail.source === "derived",
	).length;
	const needsDetails = missingCount > 0 || requiredMappedCount > 0;
	const commonFields = {
		score,
		completeCount,
		missingCount,
		recommendedMissingCount,
		profileKey: profile.key,
		profileName: profile.displayName,
		sourceCounts,
		details,
		needsDetails,
	};

	if (missingCount === 0 && requiredMappedCount === 0) {
		return {
			status: "complete",
			label: profile.completeLabel,
			title: "All required nutrients are present from exact source fields.",
			...commonFields,
		};
	}

	if (missingCount === 0) {
		return {
			status: "resolved",
			label: profile.resolvedLabel,
			title:
				"All required nutrients are available, with some values mapped or derived.",
			...commonFields,
		};
	}

	if (completeCount >= Math.ceil(requiredDetails.length * 0.6)) {
		return {
			status: "partial",
			label: profile.partialLabel,
			title: `${completeCount}/${requiredDetails.length} required nutrients are available.`,
			...commonFields,
		};
	}

	return {
		status: "limited",
		label: profile.limitedLabel,
		title: `${completeCount}/${requiredDetails.length} required nutrients are available. Some graph values may be incomplete.`,
		...commonFields,
	};
};

export const compareNutritionCompleteness = (
	a: FoodItem,
	b: FoodItem,
	catalog?: NutritionCompletenessCatalog,
) => {
	const completenessA = assessNutritionCompleteness(a, catalog);
	const completenessB = assessNutritionCompleteness(b, catalog);
	return completenessB.score - completenessA.score;
};

const getNutrientCompletenessDetail = (
	nutrientId: number,
	label: string,
	source: NutrientResolutionMethod,
	requirementLevel: NutritionRequirementLevel,
): NutrientCompletenessDetail => {
	if (source === "missing") {
		return {
			nutrientId,
			label,
			source,
			sourceLabel: "Missing",
			detail: "Not reported in this source record.",
			requirementLevel,
		};
	}

	if (source === "derived") {
		return {
			nutrientId,
			label,
			source,
			sourceLabel: "Derived",
			detail: "Calculated from available macro nutrients.",
			requirementLevel,
		};
	}

	if (source === "mapped") {
		return {
			nutrientId,
			label,
			source,
			sourceLabel: "Mapped",
			detail: "Resolved from an alternate source nutrient field.",
			requirementLevel,
		};
	}

	return {
		nutrientId,
		label,
		source,
		sourceLabel: "Exact",
		detail: "Matched the expected source nutrient field.",
		requirementLevel,
	};
};
