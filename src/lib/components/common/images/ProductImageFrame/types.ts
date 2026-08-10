import type { ImageRotationDegrees } from "$lib/utils/food/images/types";

export type ProductImageFrameProps = {
	src: string;
	alt: string;
	loading?: "eager" | "lazy";
	rotationDegrees?: ImageRotationDegrees;
	onError?: () => void;
};
