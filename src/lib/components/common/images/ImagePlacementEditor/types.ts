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
	editable?: boolean;
	smartPlacementSource?: Blob | string;
	onChange?: (value: ImagePlacementValue) => void;
};
