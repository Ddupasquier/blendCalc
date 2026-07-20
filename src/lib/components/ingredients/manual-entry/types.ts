import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type ManualEntryCreateContext = {
	destination: SmoothieListKey;
	addedToList: boolean;
	source: "manual-entry";
};

export type ManualEntryCreateHandler = (
	food: FdcFood,
	context: ManualEntryCreateContext,
) => void | Promise<void>;

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
