import type { BarcodeScanResult } from "$lib/utils/barcode/types";

export type BarcodeScannerDialogProps = {
	open: boolean;
	onDetected: (result: BarcodeScanResult) => void;
	onClose: () => void;
};
