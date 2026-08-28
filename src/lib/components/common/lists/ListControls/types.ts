export type ListFilterOption = {
	value: string;
	label: string;
};

export type ListControlsProps = {
	id: string;
	query: string;
	onQueryChange: (value: string) => void;
	placeholder?: string;
	label?: string;
	totalCount: number;
	visibleCount: number;
	itemLabel?: string;
	showCount?: boolean;
	resultSummary?: string;
	filterLabel?: string;
	filterValue?: string;
	filterOptions?: readonly ListFilterOption[];
	onFilterChange?: (value: string) => void;
	filtersActive?: boolean;
	filterControlsId?: string;
	onFilterOpen?: () => void;
};
