import type { ListFilterOption } from "../ListControls/types";

export type ListSortSheetProps = {
	open: boolean;
	value: string;
	options: readonly ListFilterOption[];
	label: string;
	title?: string;
	titleId: string;
	loading?: boolean;
	onApply: (value: string) => void;
	onClose: () => void;
};
