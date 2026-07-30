import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";

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
};
