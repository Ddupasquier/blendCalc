export type BarcodeAutofillSuggestionProps = {
	name: string;
	brandOwner?: string;
	sourceLabel: string;
	heading?: string;
	description?: string;
	applyLabel?: string;
	keepLabel?: string;
	extraLabel?: string;
	tone?: "default" | "error";
	onApply: () => void | Promise<void>;
	onKeepManual: () => void;
	onExtra?: () => void;
};
