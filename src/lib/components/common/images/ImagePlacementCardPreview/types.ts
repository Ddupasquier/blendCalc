import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";
import type { CardWarningFrameTone } from "$lib/components/common/display/CardWarningFrame/types";

export type ImagePlacementCardPreviewProps = {
	imageUrl: string;
	alt: string;
	value: ImagePlacementValue;
	foodName?: string;
	category?: string;
	ariaLabel?: string;
	warningFrameTone?: CardWarningFrameTone | null;
	interactive?: boolean;
	instructionsId?: string;
	onChange?: (value: ImagePlacementValue) => void;
	onGeometryChange?: (geometry: ImagePlacementGeometry) => void;
	onError?: () => void;
};
