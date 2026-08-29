import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { CardWarningFrameTone } from "$lib/components/common/display/CardWarningFrame/types";

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
	warningFrameTone?: CardWarningFrameTone | null;
	smartPlacementSource?: Blob | string;
	automaticallyPlaceNewImage?: boolean;
	onPlacementProcessingStateChange?: (busy: boolean) => void;
	onChange?: (value: ImagePlacementValue) => void;
};
