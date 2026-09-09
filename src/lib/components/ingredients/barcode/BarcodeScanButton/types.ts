export type BarcodeScanButtonProps = {
	scanning?: boolean;
	disabled?: boolean;
	compact?: boolean;
	label?: string;
	onclick: (event?: MouseEvent) => void;
};
