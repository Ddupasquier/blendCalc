import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { ManualEntryFormResetState } from "$lib/components/ingredients/manual-entry/utils/formState";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type { FoodItem } from "$lib/utils/food/types";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";

export type CustomIngredientFormProps = {
	onCreate: ManualEntryCreateHandler;
	onClose?: () => void;
	closeManualSignal?: number;
	scanSignal?: number;
	showScanButton?: boolean;
	inline?: boolean;
	onScannerOpen?: () => void;
	onScannerClose?: () => void;
	moveConfirmationRouteOpen?: boolean;
	onMoveConfirmationOpen?: () => void;
	onMoveConfirmationClose?: () => void;
	onLookupStateChange?: (lookingUp: boolean) => void;
	initialFood?: FoodItem;
	submissionIntent?: CatalogSubmissionIntent;
	catalogSubmissionOnly?: boolean;
	allowCheekyMessages?: boolean;
};

export type ManualEntryDraftData = Omit<
	ManualEntryFormResetState,
	| "frontPhoto"
	| "nutritionPhoto"
	| "barcodePhoto"
	| "checkingBarcodeReference"
	| "validatingBarcodeShare"
>;

export type ManualEntryDraft = {
	version: 1;
	savedAt: number;
	form: ManualEntryDraftData;
	saveDestination: IngredientListKey;
};
