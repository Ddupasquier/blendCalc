type SegmentedControlOptionBase = {
	value: string;
	label: string;
	count?: number;
	id?: string;
	controlsId?: string;
};

export type SegmentedControlLinkOption = SegmentedControlOptionBase & {
	href: string;
};

export type SegmentedControlButtonOption = SegmentedControlOptionBase & {
	href?: never;
};

export type SegmentedControlOption =
	| SegmentedControlLinkOption
	| SegmentedControlButtonOption;

export type SegmentedControlVariant = "pill" | "progress";

type SegmentedControlBaseProps = {
	label: string;
	value: string;
	variant?: SegmentedControlVariant;
};

export type SegmentedControlProps = SegmentedControlBaseProps &
	(
		| {
				options: SegmentedControlLinkOption[];
				onSelect?: never;
		  }
		| {
				options: SegmentedControlButtonOption[];
				onSelect: (value: string) => void;
		  }
	);
