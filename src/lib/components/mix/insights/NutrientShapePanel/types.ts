import type { SaveGoalDiff } from "$lib/utils/mix/ui/mixUi";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type NutrientShapePanelProps = MixSectionDisclosureProps & {
	points: number;
	values: number[];
	goalValues: number[];
	labels: string[];
	valueLabels: string[];
	pointColors: { fill: string; stroke: string }[];
	fillColor: string;
	strokeColor: string;
	diffs: SaveGoalDiff[];
};
