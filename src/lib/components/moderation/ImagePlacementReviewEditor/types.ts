import type { ImagePlacementReviewWorkspace } from "$lib/utils/moderation/imagePlacementReview";

export type ImagePlacementReviewEditorProps = {
	image: ImagePlacementReviewWorkspace["images"][number];
	disabled?: boolean;
	onBusyChange?: (busy: boolean) => void;
};
