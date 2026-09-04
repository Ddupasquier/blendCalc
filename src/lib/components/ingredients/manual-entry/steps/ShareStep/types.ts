import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset, FoodSafetyAlert } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type { ManualEntryDestinationAction } from "$lib/components/ingredients/manual-entry/utils/listMembership";
import type { ManualEntryCatalogMessageTone } from "$lib/components/ingredients/manual-entry/utils/submitFlow";
import type {
	SharedProductEvidenceRole,
	SharedProductSubmissionProgress,
} from "$lib/utils/products/catalog";
import type { PhotoUploadStatus } from "$lib/components/common/forms/PhotoUploadInput/types";
import type {
	ManualEntryBarcodeShareMismatch,
	ManualEntrySummaryItem,
	ManualEntryValidationItem,
} from "../../formTypes";

export type ShareStepProps = {
	normalizedName: string;
	brandOwner: string;
	activeCategory: string;
	summaryNutrients: ManualEntrySummaryItem[];
	optionalNutrientCount: number;
	hasAcceptedBarcodeNutrients: boolean;
	validationItems: ManualEntryValidationItem[];
	barcodeMessage: string;
	barcodeSafetyAlerts: FoodSafetyAlert[];
	canShareWithCatalog: boolean;
	shareUnavailableMessage: string;
	shareHelpMessage: string;
	shareWithCatalog: boolean;
	barcodeShareMismatch: ManualEntryBarcodeShareMismatch;
	lookingUpBarcode: boolean;
	validatingBarcodeShare: boolean;
	requiresCatalogEvidence: boolean;
	showOptionalProductImageUpload: boolean;
	trustedProductImage: FoodImageAsset | undefined;
	frontPhoto: File | null;
	nutritionPhoto: File | null;
	barcodePhoto: File | null;
	imagePlacement: ImagePlacementValue;
	regulatoryDisclosureProfile: ProductRegulatoryDisclosureProfile | null;
	alcoholByVolumePercent: number | null;
	packageQuantityLabel: string;
	usesNonstandardNutritionDisclosure: boolean;
	saveDestination: IngredientListKey;
	destinationAction: ManualEntryDestinationAction;
	reviewedUpdate: boolean;
	error: string;
	placementMessage: string;
	catalogMessage: string;
	catalogMessageTone: ManualEntryCatalogMessageTone;
	saving: boolean;
	evidenceProgress: SharedProductSubmissionProgress | null;
	catalogSubmissionOnly: boolean;
	onShareChange: (checked: boolean) => void | Promise<void>;
	onApplyVerifiedBarcode: () => void | Promise<void>;
	onDetachBarcodeForPrivateSave: () => void;
	onSubmitBarcodeCorrection: () => void;
	onFrontPhotoChange: (file: File | null) => void;
	onImagePlacementChange: (value: ImagePlacementValue) => void;
	onNutritionPhotoChange: (file: File | null) => void;
	onBarcodePhotoChange: (file: File | null) => void;
	onSaveDestinationChange: (destination: IngredientListKey) => void;
	onBack: () => void;
	onSubmit: () => void | Promise<void>;
	onCatalogSubmissionComplete: () => void;
	onSaveDestinationControl?: (element: HTMLButtonElement | null) => void;
};

export const getEvidencePhotoStatus = (
	role: SharedProductEvidenceRole,
	selected: boolean,
	progress: SharedProductSubmissionProgress | null,
): PhotoUploadStatus | undefined => {
	if (!selected) return undefined;
	if (!progress) return "ready";
	if (progress.phase === "failed") return "needs-attention";
	if (progress.phase === "uploaded") return "uploaded";
	if (progress.phase === "uploading") return "uploading";
	if (progress.phase === "preparing" && progress.role === role)
		return "preparing";
	return "ready";
};
