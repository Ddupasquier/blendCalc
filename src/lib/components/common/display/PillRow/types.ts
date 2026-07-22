export type PillRowProps = {
	pills: string[];
	onRemove?: (index: number) => void;
	onRename?: (index: number) => void;
	onSelect?: (index: number) => void;
	removable?: boolean;
	activeIndices?: number[];
	customIndices?: number[];
	disabledIndices?: number[];
	preserveOrder?: boolean;
};

export type ArrangedPill = {
	label: string;
	index: number;
	active: boolean;
	custom: boolean;
};
