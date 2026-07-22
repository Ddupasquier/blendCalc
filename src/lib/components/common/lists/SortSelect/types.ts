export type SortOption = {
	value: string;
	label: string;
};

export type SortSelectProps = {
	id: string;
	label?: string;
	value: string;
	options: readonly SortOption[];
	onChange: (value: string) => void;
};
