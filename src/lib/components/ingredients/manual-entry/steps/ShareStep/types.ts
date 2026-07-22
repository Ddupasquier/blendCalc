import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import type {
	CustomIngredientOutcomeState,
	ManualEntryBarcodeShareMismatch,
	ManualEntrySummaryItem,
	ManualEntryValidationItem,
} from "../../formTypes";

export type ShareStepProps = {
	normalizedName: string;
	activeCategory: string;
	summaryNutrients: ManualEntrySummaryItem[];
	optionalNutrientCount: number;
	validationItems: ManualEntryValidationItem[];
	barcodeMessage: string;
	canShareWithCatalog: boolean;
	shareUnavailableMessage: string;
	shareHelpMessage: string;
	shareWithCatalog: boolean;
	barcodeShareMismatch: ManualEntryBarcodeShareMismatch;
	validatingBarcodeShare: boolean;
	requiresCatalogEvidence: boolean;
	showOptionalProductImageUpload: boolean;
	trustedProductImage: FoodImageAsset | undefined;
	frontPhoto: File | null;
	nutritionPhoto: File | null;
	barcodePhoto: File | null;
	imagePlacement: ImagePlacementValue;
	saveDestination: SmoothieListKey;
	error: string;
	lastOutcome: CustomIngredientOutcomeState | null;
	outcomeAction: "move" | "undo" | null;
	savedMessage: string;
	catalogMessage: string;
	saving: boolean;
	onShareChange: (checked: boolean) => void | Promise<void>;
	onApplyVerifiedBarcode: () => void | Promise<void>;
	onDetachBarcodeForPrivateSave: () => void;
	onFrontPhotoChange: (file: File | null) => void;
	onImagePlacementChange: (value: ImagePlacementValue) => void;
	onNutritionPhotoChange: (file: File | null) => void;
	onBarcodePhotoChange: (file: File | null) => void;
	onSaveDestinationChange: (destination: SmoothieListKey) => void;
	onMoveToShopping: () => void | Promise<void>;
	onMoveToFridge: () => void | Promise<void>;
	onUndo: () => void | Promise<void>;
	onBack: () => void;
	onSubmit: () => void | Promise<void>;
	onSaveDestinationInput?: (element: HTMLSelectElement | null) => void;
};
