export type SegmentedControlOption = {
	value: string;
	label: string;
	count?: number;
	id?: string;
	controlsId?: string;
};

export type SegmentedControlVariant = "pill" | "progress";

export type SegmentedControlProps = {
	label: string;
	options: SegmentedControlOption[];
	value: string;
	variant?: SegmentedControlVariant;
	onSelect: (value: string) => void;
};
