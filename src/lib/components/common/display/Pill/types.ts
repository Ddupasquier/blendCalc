export type PillProps = {
	label: string;
	onRemove?: () => void;
	onRename?: () => void;
	onSelect?: () => void;
	removable?: boolean;
	active?: boolean;
	custom?: boolean;
	disabled?: boolean;
};
