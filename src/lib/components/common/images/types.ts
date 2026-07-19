import type { Snippet } from "svelte";
import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

export type { ImagePlacementValue } from "$lib/utils/food/images/types";

export type ImagePlacementEditorMode = "card-only" | "card-and-full";

export type ImagePlacementEditorProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	title?: string;
	description?: string;
	mode?: ImagePlacementEditorMode;
	editable?: boolean;
	privileged?: boolean;
	onChange?: (value: ImagePlacementValue) => void;
};

export type ImagePlacementCardPreviewProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	ariaLabel?: string;
	size?: "card" | "editor";
	interactive?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};

export type ImagePlacementViewportProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	interactive?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};

export type ImagePlacementDragState = {
	pointerId: number;
	startX: number;
	startY: number;
	value: ImagePlacementValue;
	geometry: ImagePlacementGeometry;
};

export type ImagePlacementPinchState = {
	startDistance: number;
	startZoom: number;
	value: ImagePlacementValue;
};

export type CircularMediaFrameProps = {
	class?: string;
	label?: string;
	children?: Snippet;
};

export type ProductImageFrameProps = {
	src: string;
	alt: string;
	loading?: "eager" | "lazy";
	onError?: () => void;
};
