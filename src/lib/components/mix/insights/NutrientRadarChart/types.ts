export type NutrientRadarAxisColor = {
	fill: string;
	stroke: string;
};

export type NutrientRadarChartProps = {
	nutrientAxisCount?: number;
	actualGoalRatios?: number[];
	targetGoalRatios?: number[];
	nutrientLabels?: string[];
	nutrientValueLabels?: string[];
	showValueLabels?: boolean;
	nutrientAxisColors?: NutrientRadarAxisColor[];
	chartSizePixels?: number;
	actualFillColor?: string;
	actualStrokeColor?: string;
	gridLineColor?: string;
	referenceBoundaryColor?: string;
	targetOutlineColor?: string;
	fullWidth?: boolean;
	class?: string;
};
