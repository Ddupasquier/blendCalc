import { resolveFdcNutrient, type FdcNutrientSource } from "./fdcNutrients";
import { NUTRIENT_IDS, type FdcFood } from "./types";

const VITAL_NUTRIENTS = [
	{ id: NUTRIENT_IDS.CALORIES, label: "Calories" },
	{ id: NUTRIENT_IDS.FAT, label: "Total Fat" },
	{ id: NUTRIENT_IDS.CARBS, label: "Total Carb." },
	{ id: NUTRIENT_IDS.FIBER, label: "Dietary Fiber" },
	{ id: NUTRIENT_IDS.SUGAR, label: "Total Sugars" },
	{ id: NUTRIENT_IDS.PROTEIN, label: "Protein" },
];

export type NutrientQualityDetail = {
	nutrientId: number;
	label: string;
	source: FdcNutrientSource;
	sourceLabel: string;
	detail: string;
};

export type FoodQuality = {
	label: string;
	symbol: string;
	title: string;
	score: number;
	completeCount: number;
	missingCount: number;
	sourceCounts: Record<FdcNutrientSource, number>;
	details: NutrientQualityDetail[];
	needsDetails: boolean;
};

export const getFoodQuality = (food: FdcFood): FoodQuality => {
	const sourceCounts: Record<FdcNutrientSource, number> = {
		exact: 0,
		fallback: 0,
		derived: 0,
		missing: 0,
	};

	const details = VITAL_NUTRIENTS.map((nutrient) => {
		const resolved = resolveFdcNutrient(food, nutrient.id);
		const detail = getNutrientQualityDetail(
			nutrient.id,
			nutrient.label,
			resolved.source,
		);
		return detail;
	});

	for (const detail of details) {
		const source = detail.source;
		sourceCounts[source] += 1;
	}

	const missingCount = sourceCounts.missing;
	const completeCount = VITAL_NUTRIENTS.length - missingCount;
	const score =
		sourceCounts.exact * 3 + sourceCounts.fallback * 2 + sourceCounts.derived;
	const needsDetails = missingCount > 0 || sourceCounts.derived > 0;

	if (missingCount === 0 && sourceCounts.fallback === 0 && sourceCounts.derived === 0) {
		return {
			label: "Complete",
			symbol: "✅",
			title: "All vital nutrients are present from exact FDC fields.",
			score,
			completeCount,
			missingCount,
			sourceCounts,
			details,
			needsDetails,
		};
	}

	if (missingCount === 0) {
		return {
			label: "Resolved",
			symbol: "🧩",
			title:
				"All vital nutrients are available, with some values mapped or derived.",
			score,
			completeCount,
			missingCount,
			sourceCounts,
			details,
			needsDetails,
		};
	}

	if (completeCount >= 4) {
		return {
			label: "Partial",
			symbol: "⚠️",
			title: `${completeCount}/${VITAL_NUTRIENTS.length} vital nutrients are available.`,
			score,
			completeCount,
			missingCount,
			sourceCounts,
			details,
			needsDetails,
		};
	}

	return {
		label: "Limited",
		symbol: "ℹ️",
		title: `${completeCount}/${VITAL_NUTRIENTS.length} vital nutrients are available. Some graph values may be incomplete.`,
		score,
		completeCount,
		missingCount,
		sourceCounts,
		details,
		needsDetails,
	};
};

export const compareFoodQuality = (a: FdcFood, b: FdcFood) => {
	const qualityA = getFoodQuality(a);
	const qualityB = getFoodQuality(b);
	return qualityB.score - qualityA.score;
};

const getNutrientQualityDetail = (
	nutrientId: number,
	label: string,
	source: FdcNutrientSource,
): NutrientQualityDetail => {
	if (source === "missing") {
		return {
			nutrientId,
			label,
			source,
			sourceLabel: "Missing",
			detail: "Not found in this FDC result.",
		};
	}

	if (source === "derived") {
		return {
			nutrientId,
			label,
			source,
			sourceLabel: "Derived",
			detail: "Calculated from available macro nutrients.",
		};
	}

	if (source === "fallback") {
		return {
			nutrientId,
			label,
			source,
			sourceLabel: "Mapped",
			detail: "Resolved from an alternate FDC nutrient field.",
		};
	}

	return {
		nutrientId,
		label,
		source,
		sourceLabel: "Exact",
		detail: "Matched the expected FDC nutrient field.",
	};
};
