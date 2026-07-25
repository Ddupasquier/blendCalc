export type ImageFitMode = "contain" | "cover" | "custom";

export type ImagePlacementMethod =
	| "default"
	| "manual"
	| "smart-ocr"
	| "smart-ocr-adjusted";

export type ImagePlacementValue = {
	cropX: number;
	cropY: number;
	cropZoom: number;
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
