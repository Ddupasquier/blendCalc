export type ImageFitMode = "contain" | "cover" | "custom";
export type ImageHorizontalMovement = "symmetric" | "left-only";
export type ImageRotationDegrees = 0 | 90 | 180 | 270;

export type ImagePlacementMethod =
	| "default"
	| "manual"
	| "smart-ocr"
	| "smart-ocr-adjusted";

export type ImagePlacementValue = {
	cropX: number;
	cropY: number;
	cropZoom: number;
	rotationDegrees: ImageRotationDegrees;
	fitMode: ImageFitMode;
	placementVersion: number;
	placementMethod?: ImagePlacementMethod;
	suggestionVersion?: string;
	suggestionConfidence?: number;
};

export type ImagePlacementGeometry = {
	ready: boolean;
	naturalWidth: number;
	naturalHeight: number;
	frameWidth: number;
	frameHeight: number;
	baseWidth: number;
	baseHeight: number;
	rotationDegrees: ImageRotationDegrees;
	effectiveZoom: number;
	coverZoom: number;
	maxOffsetX: number;
	maxOffsetY: number;
	offsetX: number;
	offsetY: number;
	canMoveX: boolean;
	canMoveY: boolean;
	horizontalMovement: ImageHorizontalMovement;
	horizontalOriginOffsetX: number;
};

export type ImagePlacementGeometryInput = {
	naturalWidth: number;
	naturalHeight: number;
	frameWidth: number;
	frameHeight: number;
	value: Partial<ImagePlacementValue>;
	horizontalMovement?: ImageHorizontalMovement;
};

export type SmartImageTextBounds = {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
};

export type SmartImageTextRegion = {
	text: string;
	confidence: number;
	bounds: SmartImageTextBounds;
};

export type SmartImagePlacementDocument = {
	width: number;
	height: number;
	regions: SmartImageTextRegion[];
};

export type SmartImagePlacementSuggestion = {
	placement: ImagePlacementValue;
	confidence: number;
	matchedText: string;
};

export type SmartImagePlacementProgress = {
	status: string;
	progress: number;
};
