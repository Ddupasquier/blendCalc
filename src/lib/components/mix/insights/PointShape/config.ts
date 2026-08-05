export const POINT_SHAPE_DEFAULTS = {
	size: 450,
	fillColor: "var(--mix-chart-success-fill)",
	strokeColor: "var(--mix-chart-success-stroke)",
	gridColor: "var(--mix-chart-grid)",
	goalColor: "var(--mix-chart-goal)",
	goalDashPattern: "1 6",
	ringCount: 3,
	chartRadiusRatio: 0.28,
	labelRadiusRatio: 0.41,
	labelHorizontalInsetRatio: 0.16,
	labelVerticalInsetRatio: 0.1,
	labelBottomInsetRatio: 0.14,
	centerAnchorThresholdRatio: 0.08,
} as const;

const getLabelSpaceDemand = (label: string) => {
	const normalizedLabel = label.trim().replace(/\s+/g, " ");
	const longestWord = normalizedLabel
		.split(" ")
		.reduce((longest, word) => Math.max(longest, word.length), 0);

	return normalizedLabel.length + longestWord;
};

const getVerticalSlotCapacity = (index: number, axisCount: number) => {
	const angle = (2 * Math.PI * index) / axisCount - Math.PI / 2;
	return Math.abs(Math.sin(angle));
};

export const getPointShapeAxisOrder = (labels: string[], axisCount: number) => {
	const sourceIndexes = Array.from({ length: axisCount }, (_value, index) => index);
	if (axisCount <= 2) return sourceIndexes;

	const labelsBySpaceDemand = [...sourceIndexes].sort((leftIndex, rightIndex) => {
		const demandDifference =
			getLabelSpaceDemand(labels[rightIndex] ?? "") -
			getLabelSpaceDemand(labels[leftIndex] ?? "");

		return demandDifference || leftIndex - rightIndex;
	});
	const slotsByVerticalCapacity = [...sourceIndexes].sort((leftIndex, rightIndex) => {
		const capacityDifference =
			getVerticalSlotCapacity(rightIndex, axisCount) -
			getVerticalSlotCapacity(leftIndex, axisCount);

		return capacityDifference || leftIndex - rightIndex;
	});
	const arrangedSourceIndexes = Array.from({ length: axisCount }, () => 0);

	labelsBySpaceDemand.forEach((sourceIndex, rank) => {
		arrangedSourceIndexes[slotsByVerticalCapacity[rank]] = sourceIndex;
	});

	return arrangedSourceIndexes;
};
