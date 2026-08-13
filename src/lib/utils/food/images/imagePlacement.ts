import type {
	ImageFitMode,
	ImagePlacementGeometry,
	ImagePlacementGeometryInput,
	ImagePlacementMethod,
	ImageRotationDegrees,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export const LEGACY_IMAGE_PLACEMENT_VERSION = 1;
export const CURRENT_IMAGE_PLACEMENT_VERSION = 2;
export const IMAGE_PLACEMENT_MIN_ZOOM = 1;
export const IMAGE_PLACEMENT_MAX_ZOOM = 8;
export const CARD_IMAGE_PLACEMENT_MIN_X = 50;
export const CARD_IMAGE_PLACEMENT_MAX_X = 100;
export const IMAGE_ROTATION_INCREMENT = 90;

const fitModes = new Set<ImageFitMode>(["contain", "cover", "custom"]);
const rotationDegrees = new Set<ImageRotationDegrees>([0, 90, 180, 270]);
const placementMethods = new Set<ImagePlacementMethod>([
	"default",
	"manual",
	"automatic-ocr",
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

export const isImageRotationDegrees = (
	value: unknown,
): value is ImageRotationDegrees =>
	typeof value === "number" &&
	rotationDegrees.has(value as ImageRotationDegrees);

export const normalizeImageRotationDegrees = (
	value: unknown,
	fallback: ImageRotationDegrees = 0,
): ImageRotationDegrees => {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return fallback;
	const normalizedValue =
		((Math.round(numericValue / IMAGE_ROTATION_INCREMENT) *
			IMAGE_ROTATION_INCREMENT) %
			360 +
			360) %
		360;
	return isImageRotationDegrees(normalizedValue)
		? normalizedValue
		: fallback;
};

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
	rotationDegrees: 0,
	fitMode: "contain",
	placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
	placementMethod: "default",
});

export const LEGACY_IMAGE_PLACEMENT: Readonly<ImagePlacementValue> = Object.freeze({
	cropX: 50,
	cropY: 50,
	cropZoom: IMAGE_PLACEMENT_MIN_ZOOM,
	rotationDegrees: 0,
	fitMode: "cover",
	placementVersion: LEGACY_IMAGE_PLACEMENT_VERSION,
	placementMethod: "manual",
});

export const createFullImagePlacement = (
	rotationDegrees: ImageRotationDegrees = 0,
): ImagePlacementValue => ({
	...FULL_IMAGE_PLACEMENT,
	rotationDegrees,
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
		rotationDegrees: normalizeImageRotationDegrees(
			value.rotationDegrees,
			fallback.rotationDegrees,
		),
		fitMode,
		placementVersion,
		placementMethod,
		...((placementMethod === "automatic-ocr" || placementMethod.startsWith("smart-ocr")) && suggestionVersion
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

export const constrainCardImagePlacement = (
	value: Partial<ImagePlacementValue>,
): ImagePlacementValue => {
	const placement = normalizeImagePlacement(value);
	return {
		...placement,
		cropX: clamp(
			placement.cropX,
			CARD_IMAGE_PLACEMENT_MIN_X,
			CARD_IMAGE_PLACEMENT_MAX_X,
			CARD_IMAGE_PLACEMENT_MIN_X,
		),
	};
};

export const EMPTY_IMAGE_PLACEMENT_GEOMETRY: Readonly<ImagePlacementGeometry> = Object.freeze({
	ready: false,
	naturalWidth: 0,
	naturalHeight: 0,
	frameWidth: 0,
	frameHeight: 0,
	baseWidth: 0,
	baseHeight: 0,
	rotationDegrees: 0,
	effectiveZoom: 1,
	coverZoom: 1,
	maxOffsetX: 0,
	maxOffsetY: 0,
	offsetX: 0,
	offsetY: 0,
	canMoveX: false,
	canMoveY: false,
	horizontalMovement: "symmetric",
	horizontalOriginOffsetX: 0,
});

export const getImagePlacementGeometry = ({
	naturalWidth,
	naturalHeight,
	frameWidth,
	frameHeight,
	value,
	horizontalMovement = "symmetric",
}: ImagePlacementGeometryInput): ImagePlacementGeometry => {
	const placement = normalizeImagePlacement(value);
	const swapsDimensions =
		placement.rotationDegrees === 90 ||
		placement.rotationDegrees === 270;
	const rotatedNaturalWidth = swapsDimensions
		? naturalHeight
		: naturalWidth;
	const rotatedNaturalHeight = swapsDimensions
		? naturalWidth
		: naturalHeight;
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
			horizontalMovement,
			rotationDegrees: placement.rotationDegrees,
			effectiveZoom:
				placement.fitMode === "contain" ? 1 : placement.cropZoom,
		};
	}

	const containScale = Math.min(
		frameWidth / rotatedNaturalWidth,
		frameHeight / rotatedNaturalHeight,
	);
	const baseWidth = rotatedNaturalWidth * containScale;
	const baseHeight = rotatedNaturalHeight * containScale;
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
	const scaledWidth = baseWidth * effectiveZoom;
	const symmetricMaxOffsetX = Math.max(0, (scaledWidth - frameWidth) / 2);
	const horizontalOriginOffsetX =
		horizontalMovement === "left-only"
			? (scaledWidth - frameWidth) / 2
			: 0;
	const maxOffsetX =
		horizontalMovement === "left-only"
			? Math.max(
				Math.max(0, scaledWidth - frameWidth),
				Math.min(scaledWidth, frameWidth) / 2,
			)
			: symmetricMaxOffsetX;
	const maxOffsetY = Math.max(0, (baseHeight * effectiveZoom - frameHeight) / 2);
	const canMoveX = maxOffsetX > 0.5;
	const canMoveY = maxOffsetY > 0.5;
	const horizontalCropX =
		horizontalMovement === "left-only"
			? clamp(
				placement.cropX,
				CARD_IMAGE_PLACEMENT_MIN_X,
				CARD_IMAGE_PLACEMENT_MAX_X,
				CARD_IMAGE_PLACEMENT_MIN_X,
			)
			: placement.cropX;

	return {
		ready: true,
		naturalWidth: round(naturalWidth),
		naturalHeight: round(naturalHeight),
		frameWidth: round(frameWidth),
		frameHeight: round(frameHeight),
		baseWidth: round(baseWidth),
		baseHeight: round(baseHeight),
		rotationDegrees: placement.rotationDegrees,
		effectiveZoom: round(effectiveZoom),
		coverZoom: round(coverZoom),
		maxOffsetX: round(maxOffsetX),
		maxOffsetY: round(maxOffsetY),
		offsetX:
			horizontalMovement === "left-only"
				? round(
					horizontalOriginOffsetX -
						((horizontalCropX - CARD_IMAGE_PLACEMENT_MIN_X) /
							(CARD_IMAGE_PLACEMENT_MAX_X -
								CARD_IMAGE_PLACEMENT_MIN_X)) *
							maxOffsetX,
				)
				: canMoveX
					? round(((50 - placement.cropX) / 50) * maxOffsetX)
					: 0,
		offsetY: canMoveY
			? round(((50 - placement.cropY) / 50) * maxOffsetY)
			: 0,
		canMoveX,
		canMoveY,
		horizontalMovement,
		horizontalOriginOffsetX: round(horizontalOriginOffsetX),
	};
};

export const getImagePlacementCropXFromOffset = (
	geometry: ImagePlacementGeometry,
	offsetX: number,
) => {
	if (geometry.maxOffsetX <= 0.5) return CARD_IMAGE_PLACEMENT_MIN_X;
	if (geometry.horizontalMovement === "left-only") {
		const shift = clamp(
			geometry.horizontalOriginOffsetX - offsetX,
			0,
			geometry.maxOffsetX,
			0,
		);
		return round(
			CARD_IMAGE_PLACEMENT_MIN_X +
				(shift / geometry.maxOffsetX) *
					(CARD_IMAGE_PLACEMENT_MAX_X - CARD_IMAGE_PLACEMENT_MIN_X),
		);
	}
	return round(
		clamp(
			50 - (offsetX / geometry.maxOffsetX) * 50,
			0,
			100,
			50,
		),
	);
};

export const createFillImagePlacement = (
	coverZoom: number,
	rotationDegrees: ImageRotationDegrees = 0,
): ImagePlacementValue => ({
	cropX: 50,
	cropY: 50,
	cropZoom: clamp(
		coverZoom,
		IMAGE_PLACEMENT_MIN_ZOOM,
		IMAGE_PLACEMENT_MAX_ZOOM,
		IMAGE_PLACEMENT_MIN_ZOOM,
	),
	rotationDegrees,
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
		placement.placementMethod === "automatic-ocr" ||
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

const moveSymmetricAxis = (
	position: number,
	delta: number,
	maxOffset: number,
) => {
	if (maxOffset <= 0.5) return 50;
	const currentOffset = ((50 - position) / 50) * maxOffset;
	const nextOffset = clamp(currentOffset + delta, -maxOffset, maxOffset, 0);
	return round(50 - (nextOffset / maxOffset) * 50);
};

const moveLeftOnlyHorizontalAxis = (
	position: number,
	delta: number,
	maxOffset: number,
) => {
	if (maxOffset <= 0.5) return CARD_IMAGE_PLACEMENT_MIN_X;
	const constrainedPosition = clamp(
		position,
		CARD_IMAGE_PLACEMENT_MIN_X,
		CARD_IMAGE_PLACEMENT_MAX_X,
		CARD_IMAGE_PLACEMENT_MIN_X,
	);
	const currentShift =
		((constrainedPosition - CARD_IMAGE_PLACEMENT_MIN_X) /
			(CARD_IMAGE_PLACEMENT_MAX_X - CARD_IMAGE_PLACEMENT_MIN_X)) *
		maxOffset;
	const nextShift = clamp(currentShift - delta, 0, maxOffset, 0);
	return round(
		CARD_IMAGE_PLACEMENT_MIN_X +
			(nextShift / maxOffset) *
				(CARD_IMAGE_PLACEMENT_MAX_X - CARD_IMAGE_PLACEMENT_MIN_X),
	);
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
		cropX:
			geometry.horizontalMovement === "left-only"
				? moveLeftOnlyHorizontalAxis(
					placement.cropX,
					deltaX,
					geometry.maxOffsetX,
				)
				: moveSymmetricAxis(
					placement.cropX,
					deltaX,
					geometry.maxOffsetX,
				),
		cropY: moveSymmetricAxis(
			placement.cropY,
			deltaY,
			geometry.maxOffsetY,
		),
	};
};

export const zoomImagePlacement = (
	value: Partial<ImagePlacementValue>,
	zoom: number,
): ImagePlacementValue => createCustomImagePlacement(value, zoom);

export const rotateImagePlacement = (
	value: Partial<ImagePlacementValue>,
): ImagePlacementValue => {
	const placement = createCustomImagePlacement(value);
	const nextRotation = normalizeImageRotationDegrees(
		placement.rotationDegrees + IMAGE_ROTATION_INCREMENT,
	);

	return constrainCardImagePlacement({
		...placement,
		rotationDegrees: nextRotation,
		placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
	});
};
