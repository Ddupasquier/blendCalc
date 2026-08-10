import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

const clamp = (value: number, min: number, max: number, fallback: number) => {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
};

export const getLegacyImagePlacementCssVars = (
	value: Partial<ImagePlacementValue>,
	prefix: string,
) => {
	const cropX = clamp(value.cropX ?? 50, 0, 100, 50);
	const cropY = clamp(value.cropY ?? 50, 0, 100, 50);
	const cropZoom = clamp(value.cropZoom ?? 1, 1, 4, 1);
	const translateX = 50 - cropX;
	const translateY = 50 - cropY;

	return [
		`--${prefix}-focus-x: ${cropX}%`,
		`--${prefix}-focus-y: ${cropY}%`,
		`--${prefix}-zoom: ${cropZoom}`,
		`--${prefix}-translate-x: ${translateX}%`,
		`--${prefix}-translate-y: ${translateY}%`,
	].join("; ");
};

export const getImagePlacementGeometryCssVars = (
	geometry: ImagePlacementGeometry,
	prefix: string,
) => {
	const swapsDimensions =
		geometry.rotationDegrees === 90 ||
		geometry.rotationDegrees === 270;
	const imageWidth = swapsDimensions
		? geometry.baseHeight
		: geometry.baseWidth;
	const imageHeight = swapsDimensions
		? geometry.baseWidth
		: geometry.baseHeight;

	return [
		`--${prefix}-image-width: ${imageWidth}px`,
		`--${prefix}-image-height: ${imageHeight}px`,
		`--${prefix}-zoom: ${geometry.effectiveZoom}`,
		`--${prefix}-rotation: ${geometry.rotationDegrees}deg`,
		`--${prefix}-offset-x: ${geometry.offsetX}px`,
		`--${prefix}-offset-y: ${geometry.offsetY}px`,
	].join("; ");
};
