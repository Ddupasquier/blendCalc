import { resolveFdcNutrient, type FdcNutrientSource } from "$lib/utils/food/nutrients/fdcNutrients";
import type { FdcFood } from "$lib/utils/food/types";
import {
	getNutritionCompletenessProfile,
	type NutritionCompletenessCatalog,
	type NutritionRequirementLevel,
} from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export type NutrientQualityDetail = {
	nutrientId: number;
	label: string;
	source: FdcNutrientSource;
	sourceLabel: string;
	detail: string;
	requirementLevel: NutritionRequirementLevel;
};

export type FoodQuality = {
	status: "complete" | "resolved" | "partial" | "limited" | "unavailable";
	label: string;
	symbol: string;
	title: string;
	score: number;
	completeCount: number;
	missingCount: number;
	recommendedMissingCount: number;
	profileKey: string | null;
	profileName: string | null;
	sourceCounts: Record<FdcNutrientSource, number>;
	details: NutrientQualityDetail[];
	needsDetails: boolean;
};

const createSourceCounts = (): Record<FdcNutrientSource, number> => ({
	exact: 0,
	fallback: 0,
	derived: 0,
	missing: 0,
});

const sourceScores: Record<FdcNutrientSource, number> = {
	exact: 3,
	fallback: 2,
	derived: 1,
	missing: 0,
};

export const getFoodQuality = (
	food: FdcFood,
	catalog?: NutritionCompletenessCatalog,
): FoodQuality => {
	const profile = getNutritionCompletenessProfile(food, catalog);
	if (!profile) {
		return {
			status: "unavailable",
			label: "Unavailable",
			symbol: "ℹ️",
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
		const resolved = resolveFdcNutrient(food, nutrient.nutrientId);
		const detail = getNutrientQualityDetail(
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
		(detail) => detail.source === "fallback" || detail.source === "derived",
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
			symbol: "✅",
			title: "All required nutrients are present from exact source fields.",
			...commonFields,
		};
	}

	if (missingCount === 0) {
		return {
			status: "resolved",
			label: profile.resolvedLabel,
			symbol: "🧩",
			title:
				"All required nutrients are available, with some values mapped or derived.",
			...commonFields,
		};
	}

	if (completeCount >= Math.ceil(requiredDetails.length * 0.6)) {
		return {
			status: "partial",
			label: profile.partialLabel,
			symbol: "⚠️",
			title: `${completeCount}/${requiredDetails.length} required nutrients are available.`,
			...commonFields,
		};
	}

	return {
		status: "limited",
		label: profile.limitedLabel,
		symbol: "ℹ️",
		title: `${completeCount}/${requiredDetails.length} required nutrients are available. Some graph values may be incomplete.`,
		...commonFields,
	};
};

export const compareFoodQuality = (
	a: FdcFood,
	b: FdcFood,
	catalog?: NutritionCompletenessCatalog,
) => {
	const qualityA = getFoodQuality(a, catalog);
	const qualityB = getFoodQuality(b, catalog);
	return qualityB.score - qualityA.score;
};

const getNutrientQualityDetail = (
	nutrientId: number,
	label: string,
	source: FdcNutrientSource,
	requirementLevel: NutritionRequirementLevel,
): NutrientQualityDetail => {
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

	if (source === "fallback") {
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
