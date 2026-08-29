import type { ImagePlacementGeometry } from "$lib/utils/food/images/types";

const CARD_MEDIA_MASK_FADE_END_RATIO = 0.8;
const CARD_MEDIA_VISIBLE_EDGE_CLEARANCE_PIXELS = 3;

const round = (value: number, precision = 3) => {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
};

export const getIngredientCardMediaMaskHorizontalRadiusPixels = (
	geometry: ImagePlacementGeometry,
) => {
	if (!geometry.ready || geometry.frameWidth <= 0) return null;

	const scaledImageWidth = geometry.baseWidth * geometry.effectiveZoom;
	const visibleImageRightEdge =
		geometry.frameWidth / 2 + geometry.offsetX + scaledImageWidth / 2;
	const fadeEndPosition = Math.max(
		0,
		visibleImageRightEdge - CARD_MEDIA_VISIBLE_EDGE_CLEARANCE_PIXELS,
	);

	return round(
		Math.min(
			geometry.frameWidth,
			fadeEndPosition / CARD_MEDIA_MASK_FADE_END_RATIO,
		),
	);
};
