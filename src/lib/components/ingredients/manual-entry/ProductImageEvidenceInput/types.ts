import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset } from "$lib/utils/food/types";
import type { PhotoUploadStatus } from "$lib/components/common/forms/PhotoUploadInput/types";

export type ProductImageEvidenceInputProps = {
	trustedImage?: FoodImageAsset;
	frontPhoto: File | null;
	placement: ImagePlacementValue;
	foodName?: string;
	brandName?: string;
	category?: string;
	required?: boolean;
	requireFreshPhoto?: boolean;
	description?: string;
	uploadStatus?: PhotoUploadStatus;
	uploadProgress?: number | null;
	onFrontPhotoChange: (file: File | null) => void;
	onPlacementChange: (value: ImagePlacementValue) => void;
	onPlacementProcessingStateChange?: (busy: boolean) => void;
};
