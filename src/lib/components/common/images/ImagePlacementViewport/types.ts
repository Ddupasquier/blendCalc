import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type ContainedImageInlineAlignment = "center" | "start";

export type ImagePlacementViewportProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	containedInlineAlignment?: ContainedImageInlineAlignment;
	interactive?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};

export type ImagePlacementDragState = {
	pointerId: number;
	startX: number;
	startY: number;
	value: ImagePlacementValue;
	geometry: ImagePlacementGeometry;
};

export type ImagePlacementPinchState = {
	startDistance: number;
	startZoom: number;
	value: ImagePlacementValue;
};
