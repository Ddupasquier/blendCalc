import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";

export type CustomIngredientFormProps = {
	onCreate: ManualEntryCreateHandler;
	onClose?: () => void;
	closeManualSignal?: number;
	scanSignal?: number;
	showScanButton?: boolean;
	inline?: boolean;
	onScannerOpen?: () => void;
	onScannerClose?: () => void;
	onLookupStateChange?: (lookingUp: boolean) => void;
};
