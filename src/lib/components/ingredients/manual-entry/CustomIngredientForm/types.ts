import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { ManualEntryFormResetState } from "$lib/components/ingredients/manual-entry/utils/formState";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

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
	saveDestination: SmoothieListKey;
};
