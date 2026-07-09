export type ImagePlacementValue = {
	cropX: number;
	cropY: number;
	cropZoom: number;
};

export type ImagePlacementEditorMode = "card-only" | "card-and-full";

export type ImagePlacementEditorProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	title?: string;
	description?: string;
	mode?: ImagePlacementEditorMode;
	editable?: boolean;
	onChange?: (value: ImagePlacementValue) => void;
	onReset?: () => void;
};

export type ImagePlacementCardPreviewProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	ariaLabel?: string;
};
