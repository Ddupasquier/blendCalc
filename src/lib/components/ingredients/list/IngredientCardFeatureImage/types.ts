import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type IngredientCardFeatureImageProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	interactive?: boolean;
	decorative?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};
