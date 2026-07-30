import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { FdcFood } from "$lib/utils/food/types";
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
	initialFood?: FdcFood;
	submissionIntent?: CatalogSubmissionIntent;
	catalogSubmissionOnly?: boolean;
};
