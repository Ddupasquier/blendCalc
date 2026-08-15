import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { FoodItem } from "$lib/utils/food/types";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";

export type ManualEntrySheetProps = {
	open: boolean;
	scanSignal?: number;
	onClose: () => void;
	onScannerClose?: () => void;
	moveConfirmationRouteOpen?: boolean;
	onMoveConfirmationOpen?: () => void;
	onMoveConfirmationClose?: () => void;
	onCreate: ManualEntryCreateHandler;
	onLookupStateChange?: (lookingUp: boolean) => void;
	initialFood?: FoodItem;
	submissionIntent?: CatalogSubmissionIntent;
	catalogSubmissionOnly?: boolean;
	allowCheekyMessages?: boolean;
};
