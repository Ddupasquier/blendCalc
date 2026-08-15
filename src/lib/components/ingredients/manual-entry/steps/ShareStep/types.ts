import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type {
	CustomIngredientOutcomeState,
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
	validationItems: ManualEntryValidationItem[];
	barcodeMessage: string;
	canShareWithCatalog: boolean;
	shareUnavailableMessage: string;
	shareHelpMessage: string;
	shareWithCatalog: boolean;
	barcodeShareMismatch: ManualEntryBarcodeShareMismatch;
	lookingUpBarcode: boolean;
	allowCheekyMessages?: boolean;
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
	error: string;
	lastOutcome: CustomIngredientOutcomeState | null;
	outcomeAction: "move" | "undo" | null;
	savedMessage: string;
	catalogMessage: string;
	saving: boolean;
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
	onMoveToShopping: () => void | Promise<void>;
	onMoveToFridge: () => void | Promise<void>;
	onUndo: () => void | Promise<void>;
	onBack: () => void;
	onSubmit: () => void | Promise<void>;
	onCatalogSubmissionComplete: () => void;
	onSaveDestinationControl?: (element: HTMLButtonElement | null) => void;
};
