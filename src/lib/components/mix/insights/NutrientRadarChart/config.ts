export const NUTRIENT_RADAR_CHART_DEFAULTS = {
	chartSizePixels: 450,
	actualFillColor: "var(--mix-chart-success-fill)",
	actualStrokeColor: "var(--mix-chart-success-stroke)",
	gridLineColor: "var(--mix-chart-grid)",
	referenceBoundaryColor: "var(--mix-chart-reference-boundary)",
	targetOutlineColor: "var(--mix-chart-goal)",
	goalDashPattern: "1 6",
	ringCount: 3,
	chartRadiusRatio: 0.28,
	labelRadiusRatio: 0.41,
	labelHorizontalInsetRatio: 0.16,
	labelVerticalInsetRatio: 0.1,
	labelBottomInsetRatio: 0.14,
	centerAnchorThresholdRatio: 0.08,
} as const;

const calculateNutrientLabelSpaceDemand = (label: string) => {
	const normalizedLabel = label.trim().replace(/\s+/g, " ");
	const longestWord = normalizedLabel
		.split(" ")
		.reduce((longest, word) => Math.max(longest, word.length), 0);

	return normalizedLabel.length + longestWord;
};

const calculateAxisPositionVerticalCapacity = (
	axisPosition: number,
	axisCount: number,
) => {
	const angle = (2 * Math.PI * axisPosition) / axisCount - Math.PI / 2;
	return Math.abs(Math.sin(angle));
};

export const getNutrientRadarChartAxisOrder = (
	nutrientLabels: string[],
	axisCount: number,
) => {
	const sourceIndexes = Array.from({ length: axisCount }, (_value, index) => index);
	if (axisCount <= 2) return sourceIndexes;

	const sourceIndexesByLabelSpaceDemand = [...sourceIndexes].sort((leftIndex, rightIndex) => {
		const demandDifference =
			calculateNutrientLabelSpaceDemand(nutrientLabels[rightIndex] ?? "") -
			calculateNutrientLabelSpaceDemand(nutrientLabels[leftIndex] ?? "");

		return demandDifference || leftIndex - rightIndex;
	});
	const axisPositionsByVerticalCapacity = [...sourceIndexes].sort((leftIndex, rightIndex) => {
		const capacityDifference =
			calculateAxisPositionVerticalCapacity(rightIndex, axisCount) -
			calculateAxisPositionVerticalCapacity(leftIndex, axisCount);

		return capacityDifference || leftIndex - rightIndex;
	});
	const sourceIndexesByAxisPosition = Array.from({ length: axisCount }, () => 0);

	sourceIndexesByLabelSpaceDemand.forEach((sourceIndex, demandRank) => {
		sourceIndexesByAxisPosition[axisPositionsByVerticalCapacity[demandRank]] = sourceIndex;
	});

	return sourceIndexesByAxisPosition;
};
