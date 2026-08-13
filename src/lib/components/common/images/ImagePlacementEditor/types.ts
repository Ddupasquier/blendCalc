import type { ImagePlacementValue } from "$lib/utils/food/images/types";

export type ImagePlacementEditorProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	foodName?: string;
	brandName?: string;
	category?: string;
	title?: string;
	description?: string;
	showIntro?: boolean;
	editable?: boolean;
	showWarningEdge?: boolean;
	smartPlacementSource?: Blob | string;
	automaticallyPlaceNewImage?: boolean;
	onPlacementProcessingStateChange?: (busy: boolean) => void;
	onChange?: (value: ImagePlacementValue) => void;
};
