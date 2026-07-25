import type {
	ImageFitMode,
	ImagePlacementGeometry,
	ImagePlacementGeometryInput,
	ImagePlacementMethod,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export const LEGACY_IMAGE_PLACEMENT_VERSION = 1;
export const CURRENT_IMAGE_PLACEMENT_VERSION = 2;
export const IMAGE_PLACEMENT_MIN_ZOOM = 1;
export const IMAGE_PLACEMENT_MAX_ZOOM = 8;

const fitModes = new Set<ImageFitMode>(["contain", "cover", "custom"]);
const placementMethods = new Set<ImagePlacementMethod>([
	"default",
	"manual",
	"smart-ocr",
	"smart-ocr-adjusted",
]);

export const isImageFitMode = (value: unknown): value is ImageFitMode =>
	typeof value === "string" && fitModes.has(value as ImageFitMode);

export const isImagePlacementMethod = (
	value: unknown,
): value is ImagePlacementMethod =>
	typeof value === "string" &&
	placementMethods.has(value as ImagePlacementMethod);

const clamp = (value: number, min: number, max: number, fallback: number) => {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
};

const round = (value: number, precision = 4) => {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
};

export const FULL_IMAGE_PLACEMENT: Readonly<ImagePlacementValue> = Object.freeze({
	cropX: 50,
	cropY: 50,
	cropZoom: IMAGE_PLACEMENT_MIN_ZOOM,
	fitMode: "contain",
	placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
	placementMethod: "default",
});

export const LEGACY_IMAGE_PLACEMENT: Readonly<ImagePlacementValue> = Object.freeze({
	cropX: 50,
	cropY: 50,
	cropZoom: IMAGE_PLACEMENT_MIN_ZOOM,
	fitMode: "cover",
	placementVersion: LEGACY_IMAGE_PLACEMENT_VERSION,
	placementMethod: "manual",
});

export const createFullImagePlacement = (): ImagePlacementValue => ({
	...FULL_IMAGE_PLACEMENT,
});

export const normalizeImagePlacement = (
	value: Partial<ImagePlacementValue> = {},
	fallback: Readonly<ImagePlacementValue> = FULL_IMAGE_PLACEMENT,
): ImagePlacementValue => {
	const placementVersion = Number.isInteger(value.placementVersion)
		? Math.max(LEGACY_IMAGE_PLACEMENT_VERSION, Number(value.placementVersion))
		: fallback.placementVersion;
	const fallbackFitMode =
		placementVersion === LEGACY_IMAGE_PLACEMENT_VERSION
			? "cover"
			: fallback.fitMode;
	const fitMode = isImageFitMode(value.fitMode)
		? value.fitMode
		: fallbackFitMode;
	const placementMethod = isImagePlacementMethod(value.placementMethod)
		? value.placementMethod
		: fallback.placementMethod ?? "manual";
	const suggestionVersion =
		typeof value.suggestionVersion === "string" &&
			value.suggestionVersion.trim()
			? value.suggestionVersion.trim()
			: undefined;
	const suggestionConfidence = Number.isFinite(
			Number(value.suggestionConfidence),
		)
		? clamp(Number(value.suggestionConfidence), 0, 100, 0)
		: undefined;

	return {
		cropX: clamp(Number(value.cropX), 0, 100, fallback.cropX),
		cropY: clamp(Number(value.cropY), 0, 100, fallback.cropY),
		cropZoom: clamp(
			Number(value.cropZoom),
			IMAGE_PLACEMENT_MIN_ZOOM,
			IMAGE_PLACEMENT_MAX_ZOOM,
			fallback.cropZoom,
		),
		fitMode,
		placementVersion,
		placementMethod,
		...(placementMethod.startsWith("smart-ocr") && suggestionVersion
			? {
				suggestionVersion,
				suggestionConfidence,
			}
			: {}),
	};
};

export const getStoredImagePlacement = (
	value?: Partial<ImagePlacementValue> | null,
) => normalizeImagePlacement(value ?? {}, LEGACY_IMAGE_PLACEMENT);

export const EMPTY_IMAGE_PLACEMENT_GEOMETRY: Readonly<ImagePlacementGeometry> = Object.freeze({
	ready: false,
	naturalWidth: 0,
	naturalHeight: 0,
	frameWidth: 0,
	frameHeight: 0,
	baseWidth: 0,
	baseHeight: 0,
	effectiveZoom: 1,
	coverZoom: 1,
	maxOffsetX: 0,
	maxOffsetY: 0,
	offsetX: 0,
	offsetY: 0,
	canMoveX: false,
	canMoveY: false,
});

export const getImagePlacementGeometry = ({
	naturalWidth,
	naturalHeight,
	frameWidth,
	frameHeight,
	value,
}: ImagePlacementGeometryInput): ImagePlacementGeometry => {
	const placement = normalizeImagePlacement(value);
	if (
		![naturalWidth, naturalHeight, frameWidth, frameHeight].every(
			(dimension) => Number.isFinite(dimension) && dimension > 0,
		)
	) {
		return {
			...EMPTY_IMAGE_PLACEMENT_GEOMETRY,
			naturalWidth,
			naturalHeight,
			frameWidth,
			frameHeight,
			effectiveZoom:
				placement.fitMode === "contain" ? 1 : placement.cropZoom,
		};
	}

	const containScale = Math.min(
		frameWidth / naturalWidth,
		frameHeight / naturalHeight,
	);
	const baseWidth = naturalWidth * containScale;
	const baseHeight = naturalHeight * containScale;
	const coverZoom = clamp(
		Math.max(frameWidth / baseWidth, frameHeight / baseHeight),
		IMAGE_PLACEMENT_MIN_ZOOM,
		IMAGE_PLACEMENT_MAX_ZOOM,
		IMAGE_PLACEMENT_MIN_ZOOM,
	);
	const effectiveZoom =
		placement.fitMode === "contain"
			? IMAGE_PLACEMENT_MIN_ZOOM
			: placement.fitMode === "cover"
				? coverZoom
				: placement.cropZoom;
	const maxOffsetX = Math.max(0, (baseWidth * effectiveZoom - frameWidth) / 2);
	const maxOffsetY = Math.max(0, (baseHeight * effectiveZoom - frameHeight) / 2);
	const canMoveX = maxOffsetX > 0.5;
	const canMoveY = maxOffsetY > 0.5;

	return {
		ready: true,
		naturalWidth: round(naturalWidth),
		naturalHeight: round(naturalHeight),
		frameWidth: round(frameWidth),
		frameHeight: round(frameHeight),
		baseWidth: round(baseWidth),
		baseHeight: round(baseHeight),
		effectiveZoom: round(effectiveZoom),
		coverZoom: round(coverZoom),
		maxOffsetX: round(maxOffsetX),
		maxOffsetY: round(maxOffsetY),
		offsetX: canMoveX
			? round(((50 - placement.cropX) / 50) * maxOffsetX)
			: 0,
		offsetY: canMoveY
			? round(((50 - placement.cropY) / 50) * maxOffsetY)
			: 0,
		canMoveX,
		canMoveY,
	};
};

export const createFillImagePlacement = (
	coverZoom: number,
): ImagePlacementValue => ({
	cropX: 50,
	cropY: 50,
	cropZoom: clamp(
		coverZoom,
		IMAGE_PLACEMENT_MIN_ZOOM,
		IMAGE_PLACEMENT_MAX_ZOOM,
		IMAGE_PLACEMENT_MIN_ZOOM,
	),
	fitMode: "cover",
	placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
	placementMethod: "manual",
});

export const createCustomImagePlacement = (
	value: Partial<ImagePlacementValue>,
	effectiveZoom?: number,
): ImagePlacementValue => {
	const placement = normalizeImagePlacement(value);
	const followsSmartSuggestion =
		placement.placementMethod === "smart-ocr" ||
		placement.placementMethod === "smart-ocr-adjusted";
	return {
		...placement,
		cropZoom: clamp(
			effectiveZoom ?? placement.cropZoom,
			IMAGE_PLACEMENT_MIN_ZOOM,
			IMAGE_PLACEMENT_MAX_ZOOM,
			IMAGE_PLACEMENT_MIN_ZOOM,
		),
		fitMode: "custom",
		placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
		placementMethod: followsSmartSuggestion
			? "smart-ocr-adjusted"
			: "manual",
		...(!followsSmartSuggestion
			? {
				suggestionVersion: undefined,
				suggestionConfidence: undefined,
			}
			: {}),
	};
};

const moveAxis = (
	position: number,
	delta: number,
	maxOffset: number,
) => {
	if (maxOffset <= 0.5) return 50;
	const currentOffset = ((50 - position) / 50) * maxOffset;
	const nextOffset = clamp(currentOffset + delta, -maxOffset, maxOffset, 0);
	return round(50 - (nextOffset / maxOffset) * 50);
};

export const moveImagePlacement = ({
	value,
	geometry,
	deltaX,
	deltaY,
}: {
	value: Partial<ImagePlacementValue>;
	geometry: ImagePlacementGeometry;
	deltaX: number;
	deltaY: number;
}): ImagePlacementValue => {
	const placement = createCustomImagePlacement(value, geometry.effectiveZoom);
	return {
		...placement,
		cropX: moveAxis(placement.cropX, deltaX, geometry.maxOffsetX),
		cropY: moveAxis(placement.cropY, deltaY, geometry.maxOffsetY),
	};
};

export const zoomImagePlacement = (
	value: Partial<ImagePlacementValue>,
	zoom: number,
): ImagePlacementValue => createCustomImagePlacement(value, zoom);
