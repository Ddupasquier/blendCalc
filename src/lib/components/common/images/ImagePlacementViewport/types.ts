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
