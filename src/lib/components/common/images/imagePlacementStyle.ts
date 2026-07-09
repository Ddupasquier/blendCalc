import type { ImagePlacementValue } from "$lib/components/common/images/types";

const clamp = (value: number, min: number, max: number, fallback: number) => {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
};

export const getImagePlacementCssVars = (
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
