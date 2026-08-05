import type { ListFilterOption } from "../ListControls/types";

export type ListSortSheetProps = {
	open: boolean;
	value: string;
	options: readonly ListFilterOption[];
	filterValue?: string;
	filterOptions?: readonly ListFilterOption[];
	filterTitle?: string;
	label: string;
	title?: string;
	titleId: string;
	loading?: boolean;
	onApply: (value: string, filterValue?: string) => void;
	onClose: () => void;
};
