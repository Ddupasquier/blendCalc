import type { BarcodeScanResult } from "$lib/utils/barcode/types";

export type BarcodeScannerDialogProps = {
	open: boolean;
	onDetected: (result: BarcodeScanResult) => void;
	onClose: () => void;
};

export type BarcodeScannerIconProps = {
	active?: boolean;
};

export type BarcodeScanButtonProps = {
	scanning?: boolean;
	disabled?: boolean;
	compact?: boolean;
	onclick: () => void;
};
