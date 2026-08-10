export type ToggleSwitchProps = {
	id: string;
	name?: string;
	checked?: boolean;
	disabled?: boolean;
	ariaLabel: string;
	onChange?: (checked: boolean) => void;
};
