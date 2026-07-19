export type ImageFitMode = "contain" | "cover" | "custom";

export type ImagePlacementValue = {
	cropX: number;
	cropY: number;
	cropZoom: number;
	fitMode: ImageFitMode;
	placementVersion: number;
};

export type ImagePlacementGeometry = {
	ready: boolean;
	baseWidth: number;
	baseHeight: number;
	effectiveZoom: number;
	coverZoom: number;
	maxOffsetX: number;
	maxOffsetY: number;
	offsetX: number;
	offsetY: number;
	canMoveX: boolean;
	canMoveY: boolean;
};

export type ImagePlacementGeometryInput = {
	naturalWidth: number;
	naturalHeight: number;
	frameWidth: number;
	frameHeight: number;
	value: Partial<ImagePlacementValue>;
};
