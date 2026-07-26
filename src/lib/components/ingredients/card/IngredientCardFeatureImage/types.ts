import type { Snippet } from "svelte";
import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type IngredientCardFeatureImageProps = {
	imageUrl?: string;
	alt?: string;
	value?: ImagePlacementValue;
	fallback?: Snippet;
	interactive?: boolean;
	decorative?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};
