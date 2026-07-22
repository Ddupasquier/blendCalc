import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type ImagePlacementCardPreviewProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	ariaLabel?: string;
	size?: "card" | "editor";
	interactive?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};
