import type {
	ImageHorizontalMovement,
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type ImagePlacementViewportProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	horizontalMovement?: ImageHorizontalMovement;
	loading?: "eager" | "lazy";
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};
