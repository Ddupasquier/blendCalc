import type { SaveGoalDiff } from "$lib/utils/mix/ui/mixUi";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type NutrientShapePanelProps = MixSectionDisclosureProps & {
	nutrientAxisCount: number;
	actualGoalRatios: number[];
	targetGoalRatios: number[];
	nutrientLabels: string[];
	nutrientValueLabels: string[];
	nutrientAxisColors: { fill: string; stroke: string }[];
	actualFillColor: string;
	actualStrokeColor: string;
	nutrientGoalDifferences: SaveGoalDiff[];
	delightMessage?: string | null;
};
