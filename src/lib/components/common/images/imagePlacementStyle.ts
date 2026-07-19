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
) => [
	`--${prefix}-base-width: ${geometry.baseWidth}px`,
	`--${prefix}-base-height: ${geometry.baseHeight}px`,
	`--${prefix}-zoom: ${geometry.effectiveZoom}`,
	`--${prefix}-offset-x: ${geometry.offsetX}px`,
	`--${prefix}-offset-y: ${geometry.offsetY}px`,
].join("; ");
