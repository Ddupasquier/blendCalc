import type { ImagePlacementValue } from "$lib/utils/food/images/types";

export type ImagePlacementEditorMode = "card-only" | "card-and-full";

export type ImagePlacementEditorProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	title?: string;
	description?: string;
	mode?: ImagePlacementEditorMode;
	editable?: boolean;
	privileged?: boolean;
	onChange?: (value: ImagePlacementValue) => void;
};
