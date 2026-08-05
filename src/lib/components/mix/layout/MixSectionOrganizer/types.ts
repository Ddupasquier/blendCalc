import type { MixSectionId } from "$lib/utils/mix/ui/mixSectionOrder";

export type MixSectionOrganizerProps = {
	order: MixSectionId[];
	busy?: boolean;
	error?: string;
	onOrderChange: (order: MixSectionId[]) => void;
	onOrderCommit: (order: MixSectionId[]) => void;
	onDone: () => void;
};

export type MixSectionDragPosition = {
	top: number;
	left: number;
	width: number;
	height: number;
	pointerOffsetY: number;
};

export type MixSectionDragTarget = {
	sectionId: MixSectionId;
	bounds: DOMRect;
	distance: number;
};
