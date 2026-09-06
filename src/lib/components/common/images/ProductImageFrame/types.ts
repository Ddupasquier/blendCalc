import type { ImageRotationDegrees } from "$lib/utils/food/images/types";

export type ProductImageFrameProps = {
	src: string;
	alt: string;
	loading?: "eager" | "lazy";
	fetchPriority?: "high" | "low" | "auto";
	rotationDegrees?: ImageRotationDegrees;
	onError?: () => void;
};
