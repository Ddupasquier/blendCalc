import type { Snippet } from "svelte";
import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type IngredientCardMediaLaneProps = {
	imageUrl?: string;
	alt?: string;
	value?: ImagePlacementValue;
	fallback?: Snippet;
	decorative?: boolean;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};
